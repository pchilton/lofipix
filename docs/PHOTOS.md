# Photos

The `photos` table holds one row per captured image. The image bytes never
enter the database — the row describes the *metadata* of an image, and the
bytes live in a backing store (see [Backing stores](#backing-stores)).

Model: `packages/db/models/photo.ts` (Drizzle table `photos`, plus the shared
Zod schemas `photoSelectSchema` / `photoInsertSchema` and the types `Photo` /
`NewPhoto`).

## Columns

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | UUIDv7, primary key. Generated with `uuidv7()` from the `uuid` package so the PWA (a browser app) can mint ids offline. |
| `album_id` | `uuid` | Foreign key to `albums.id`, `ON DELETE CASCADE`. Every photo belongs to exactly one album. |
| `position` | `integer` | Position of the photo in the album, starting at 1. Required, no default: the value is always explicit. |
| `image_width` | `integer` | Width in pixels of the stored (rotated and resized) image. |
| `image_height` | `integer` | Height in pixels of the stored (rotated and resized) image. |
| `image_quality` | `integer` | JPEG quality used for the stored image, `1..100`. |
| `image_size` | `integer` | Size in bytes of the stored image. |
| `captured_at` | `timestamptz` | When the photo was captured on the device. Required, set by the client — never defaulted to `now()` server-side, which would record sync time instead of capture time. |
| `checksum` | `text` | Lowercase hex SHA-256 of the stored bytes. Nullable until the image has been processed. De-duplication is decided in application code; the database neither indexes nor constrains uniqueness here. |
| `deleted_at` | `timestamptz` | Tombstone. Null for live rows, set when the photo is deleted. |
| `created_at` | `timestamptz` | Row creation time, `now()` by default. |
| `updated_at` | `timestamptz` | Row update time, `now()` by default. |

## Constraints

- `UNIQUE (album_id, position) WHERE deleted_at IS NULL` — position is unique
  among the live photos of an album. The predicate is what makes tombstoning
  work: a deleted photo keeps its row (so the delete propagates through
  PowerSync) without permanently burning its position.
- `CHECK (position > 0)`, `CHECK (image_width > 0)`, `CHECK (image_height > 0)`,
  `CHECK (image_quality BETWEEN 1 AND 100)`, `CHECK (image_size >= 0)`.
- The same ranges are mirrored by Zod refinements on the shared schemas, so
  invalid values are rejected at the API boundary as well as by the database.

## Soft deletes

`photos` is a synced table, so deletes are tombstones rather than row
removals: the row stays with `deleted_at` set and the deletion propagates to
other clients through PowerSync. Queries for an album must filter out
tombstoned rows.

`albums` uses the same convention (`albums.deleted_at`): tombstoning an album
tombstones its photos, so that the deletion of the whole album propagates to
every client.

## Sync

`photos` is listed in the PowerSync publication (see `docs/POWERSYNC.md`).
The PWA creates photo rows offline, which is why the id, `position` and
`captured_at` are supplied by the client.

## Backing stores

The image bytes are stored in three places over the life of a photo:

1. **OPFS** — the local copy on the PWA device while the photo is offline.
2. **SeaweedFS** — the canonical copy in object storage, reached through
   pre-signed URLs issued by the API (see `docs/STORAGE.md`).
3. **OneDrive / Google Drive** — an optional copy synced from the canonical
   object.

The table currently holds no pointer to any of these: modelling where a photo
lives is deliberately left to a later task.
