# Photos

An **album** is a container for a series of photos; the `photos` table holds
one row per captured image. The image bytes never enter the database — the row
describes the *metadata* of an image, and the bytes live in a backing store
(see [Backing stores](#backing-stores)).

Models: `packages/db/models/album.ts` (Drizzle table `albums`, plus the shared
Zod schemas `albumSelectSchema` / `albumInsertSchema` and the types `Album` /
`NewAlbum`) and `packages/db/models/photo.ts` (Drizzle table `photos`, plus the
shared Zod schemas `photoSelectSchema` / `photoInsertSchema` and the types
`Photo` / `NewPhoto`).

## Albums

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | UUIDv7, primary key. Generated with `uuidv7()` from the `uuid` package so the mobile app can mint ids offline. |
| `organization_id` | `text` | Foreign key to `auth.organization(id)`, `ON DELETE CASCADE`. An album always belongs to exactly one organisation. |
| `name` | `text` | Human-readable album name. |
| `notes` | `text` | Free-form notes, nullable. Paragraphs are delimited by a single blank line (two `\n`). See [Album notes](#album-notes). |
| `version` | `bigint` | Server-incremented optimistic-concurrency version. Starts at 1. |
| `deleted_at` | `timestamptz` | Tombstone. Null for live rows, set when the album is deleted. |
| `created_at` | `timestamptz` | Row creation time, `now()` by default. |
| `updated_at` | `timestamptz` | Row update time, `now()` by default. |

### Album notes

`notes` holds a set of paragraphs. The format is:

- paragraphs are separated by a **single blank line** — two `\n` characters;
  a run of three or more newlines is collapsed to two;
- line endings are normalised to `\n` (`\r\n` and lone `\r` become `\n`);
- trailing whitespace is stripped from every line, and the value is trimmed;
- an empty value is stored as `NULL`, so `notes IS NULL` always means "no
  notes".

The normalisation is implemented once, as a Zod transform shared by
`albumSelectSchema` and `albumInsertSchema`
(`packages/db/models/album.ts`), so the same rules apply to writes and to
reads. There is no database constraint: the column is free-form text and the
database neither indexes nor constrains it.

`notes` is written both server-side and offline by the mobile app, so it is part of
the `albums` sync stream (see `docs/POWERSYNC.md`).

## Photos

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | UUIDv7, primary key. Generated with `uuidv7()` from the `uuid` package so the mobile app can mint ids offline. |
| `album_id` | `uuid` | Foreign key to `albums(id)`, `ON DELETE CASCADE`. Every photo belongs to exactly one album; the album carries the organisation. |
| `position` | `integer` | Position of the photo in the album, starting at 1. Required, no default: the value is always explicit. |
| `image_width` | `integer` | Width in pixels of the stored (rotated and resized) image. |
| `image_height` | `integer` | Height in pixels of the stored (rotated and resized) image. |
| `image_quality` | `integer` | JPEG quality used for the stored image, `1..100`. |
| `image_size` | `integer` | Size in bytes of the stored image. |
| `originated_at` | `timestamptz` | When the photo was captured on the device. Required, set by the client — never defaulted to `now()` server-side, which would record sync time instead of capture time. |
| `image_checksum` | `text` | Lowercase hex SHA-256 of the stored bytes. Nullable until the image has been processed. De-duplication is decided in application code; the database neither indexes nor constrains uniqueness here. |
| `version` | `bigint` | Server-incremented optimistic-concurrency version. Starts at 1. |
| `deleted_at` | `timestamptz` | Tombstone. Null for live rows, set when the photo is deleted. |
| `created_at` | `timestamptz` | Row creation time, `now()` by default. |
| `updated_at` | `timestamptz` | Row update time, `now()` by default. |

## Photo constraints

- `UNIQUE (album_id, position) WHERE deleted_at IS NULL` — position is unique
  among the live photos of an album. The predicate is what makes tombstoning
  work: a deleted photo keeps its row (so the delete propagates through
  PowerSync streams) without permanently burning its position.
- `CHECK (position > 0)`, `CHECK (image_width > 0)`, `CHECK (image_height > 0)`,
  `CHECK (image_quality BETWEEN 1 AND 100)`, `CHECK (image_size >= 0)`.
- The same ranges are mirrored by Zod refinements on the shared schemas, so
  invalid values are rejected at the API boundary as well as by the database.

## Soft deletes

`photos` is a synced table, so deletes are tombstones rather than row
removals: the row stays with `deleted_at` set and the deletion propagates to
other clients through PowerSync streams. Queries for an album must filter out
tombstoned rows.

`albums` uses the same convention (`albums.deleted_at`): tombstoning an album
tombstones its photos, so that the deletion of the whole album propagates to
every client.

## Sync

`albums` and `photos` are served as PowerSync Sync Streams (see
`docs/POWERSYNC.md`). `albums` filters directly on `organization_id`; `photos`
joins to `albums` because the photos table has no organisation column. Both
streams include tombstones; the mobile app filters `deleted_at is null` in
reads.

The mobile app creates photo rows offline, which is why the id, `position` and
`originated_at` are supplied by the client. PowerSync's upload queue posts them
to `POST /api/sync/upload`, which checks the parent album's organisation and the
`version`/`baseVersion` pair.

## Backing stores

The image bytes are stored in three places over the life of a photo:

1. **Device filesystem** — the local copy in the mobile app's documents directory while the photo is offline. `app_fs` or `opfs` (see `docs/PHOTO_LOCATIONS.md`).
2. **SeaweedFS** — the canonical copy in object storage, reached through
   pre-signed URLs issued by the API (see `docs/STORAGE.md`).
3. **OneDrive / Google Drive** — an optional copy synced from the canonical
   object.

The `photos` table holds no pointer to any of these; where a photo lives is
modelled by `photo_locations` (see `docs/PHOTO_LOCATIONS.md`).
