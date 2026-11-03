# Mobile app (`mobile/`) — Storyboard

Offline-first capture app for iOS and Android. It talks directly to the API;
there is no web/PWA build.

Stack: bare React Native CLI (no Expo runtime), React Navigation native-stack,
embedded SQLite via `@op-engineering/op-sqlite` + Drizzle, ElectricSQL shape
streams through the API proxy, a SQLite outbox, Better Auth bearer tokens in
`react-native-keychain`, and photo bytes in the app documents directory.
`packages/ui` is web-only ShadCN; mobile uses React Native primitives with
shared StyleSheet tokens.

Native modules: `react-native-camera-kit` (capture), `@op-engineering/op-sqlite`,
`react-native-file-access` (documents directory and native SHA-256),
`react-native-keychain`, `react-native-svg`, `@bam.tech/react-native-image-resizer`,
`@react-native-community/netinfo` and `@react-native-async-storage/async-storage`.
`react-native-camera-kit` was chosen over VisionCamera because its bare-RN setup
has no nitro-module peer requirements. SHA-256 uses the file-access native hash
instead of `@noble/hashes`, so large photos are not base64-decoded in JS.

## Core loop

```text
Welcome / login
  → Dashboard (view albums)
  → Create Album ─┐
  → open existing ┘
  → Take Photos → Finish Album (review / delete)
  → Submit (enqueue metadata) → Dashboard (album on top, sync progress)
  → repeat
```

All capture steps work offline; sync happens when connectivity returns.

## Logged out user

If there is no cached session, the app prompts to sign in.

### Welcome (`/`)

Authenticate before anything else. Sign-in works online; the session profile
and bearer token persist so later launches work offline.

- Fields: email, password, Sign in button.
- Validation + auth errors inline; loading state on submit.
- Success → Dashboard. Offline with no cached session → blocked with a
  "connect to sign in" state.

## Logged in user

The app knows the user and their single active organisation.

### Dashboard (`/`)

Cut-down album view, reverse created order, sync progress visible.

- **Create Album card** (prominent, top):
  - Name (required, e.g. license plate), Notes (optional freetext, stored as
    paragraphs), Start button.
  - Notes contract (shared schema, see `docs/PHOTOS.md`): free text, paragraphs
    separated by a single blank line; line endings normalised to `\n`; an empty
    value stored as null.
  - If the name already exists: replace Start with an "Album already exists"
    note and an emphasised **Review Existing** button → Finish Album for that
    album.
- **Most-recent album card**: mirrors Finish Album (thumbnail strip, counts,
  sync badge).
- **Album list**: older albums with thumbnails + per-photo sync state
  (device-only / queued / synced).
- Tap any album → Finish Album (review) or Take Photos (add more).

### Take Photos (`/albums/:id/capture`)

Full-screen native camera for the current album.

- Camera preview; permission requested only on this screen, with loading,
  denied and unavailable states.
- Capture button (large, central); each shot is compressed, written to the
  documents directory, and inserted as a local SQLite row instantly.
- Thumbnail strip: last three captures.
- Finish button → Finish Album.
- Fully offline; every capture has local-success state, sync queued separately.

### Finish Album (`/albums/:id/finish`)

Review everything on the device before submitting.

- Photo grid from SQLite; tap to review full-size.
- Delete with confirmation (local tombstone; propagates on sync if already
  uploaded).
- Status chips per photo: device-only → queued → synced.
- **Notes**: free text, editable on the device, paragraphs separated by a
  single blank line; saved with the album row and synced with it.
- **Add Photos** (emphasised when arriving via "Album already exists") → back
  to Take Photos.
- **Submit**: enqueues local photo metadata for sync, returns to Dashboard with
  this album on top.

### Photo review (`/albums/:id/photos/:photoId`)

Full-size local image from the app documents directory.

- Previous/Next controls, delete with confirmation, back to Finish Album.
- Other devices show a **Device-only photo** state when the bytes are absent.

## Local database

- SQLite is opened with `@op-engineering/op-sqlite` and accessed through Drizzle.
- Local tables mirror the public columns of the four synced tables
  (`albums`, `photos`, `photo_locations`, `storage_providers`) plus a
  client-only `outbox_needed` flag. They intentionally have no foreign keys so
  shape delivery order cannot fail a write.
- `outbox` and `local_meta` are client-only tables.
- Synced rows are a cache; the outbox is the only durable local work.
- `bun run schema:generate` (from `mobile/`) produces the bundled DDL from the
  Drizzle schema. `LOCAL_SCHEMA_VERSION` drives a **cache rebuild**: when the version changes,
  the app refuses to rebuild while offline or while the outbox has
  `pending`/`inflight`/`failed` mutations. Once the outbox is drained, the
  SQLite cache is recreated from bundled DDL and resynced. There are no
  incremental SQL migration files for the mobile cache.
- Signing out warns when the outbox has pending work, then clears the database,
  cached session and local photo bytes.

## Sync

Reads: after sign-in the app starts one Electric `ShapeStream` per table at
`/api/sync/shapes/:table`, sending the bearer token. The API resolves the
session, injects the `organization_id` filter, column projection and Electric
secret. A custom writer applies change messages to SQLite; `must-refetch`
clears non-pending local rows and replays the snapshot. Tombstones are synced
and reads filter `deletedAt == null`. A change notifier re-queries screens after
each batch.

Writes: a local write sets `outbox_needed`, then the row or changed columns are
written to the SQLite `outbox` with a UUIDv7 mutation id and the local `version`
as `baseVersion`. The sender coalesces pending edits per record and posts one
mutation per record at a time to `POST /api/sync/mutations` with the bearer
token.

The API applies each mutation in its own transaction with a version check,
turns deletes into `deleted_at` tombstones, and records the mutation id in
`sync_mutations` so retries are idempotent. Applied rows/versions are written
back to SQLite; conflicts replace the local row with the server row and drop
the pending edit; rejected mutations become `dead`. Retries back off
exponentially; dead rows are retried once on the next app start.

A startup reconciliation pass catches the crash window between a local row
write and its outbox insert by finding rows with `outbox_needed = true` that
have no matching outbox entry.

The full outbox/version contract is in `docs/ELECTRICSQL.md`.

## Photos

- Capture with the native camera.
- Compress to a maximum width of 1280 px as JPEG toward 300 KB (initial
  quality 0.82, quality floor 0.4).
- Compute a lowercase hex SHA-256 of the stored bytes.
- Save under `photos/<photo-id>.jpg` in the app documents directory.
- Insert only metadata into SQLite and the sync outbox.
- Bytes remain device-only; SeaweedFS upload is a later task.

## Authentication

- Better Auth bearer plugin on the API; the mobile client stores the token in
  `react-native-keychain`.
- The non-secret session profile (user id, email, name, active organisation) is
  cached in AsyncStorage.
- API, shape and mutation requests send `Authorization: Bearer`.
- A `401` marks the session stale and prompts re-login without discarding local
  work.

## Environment configuration

There is no `window.location` in React Native. The app selects endpoints at
build time:

- **Development:** API `http://192.168.1.15:5634/`, website
  `http://192.168.1.15:5173/`. Use the LAN IP; Android emulators may need
  `10.0.2.2` mapped to the host.
- **Production:** API `https://oceania.lofipix.app/`, website
  `https://www.lofipix.app/`.

The native app has no web build and does not use a PWA domain.

## Icons and UI

- Icons come from bundled Iconify data rendered with `react-native-svg`; static
  icon names only, no runtime fetch. See `docs/ICONS.md`.
- Components are React Native primitives styled with `StyleSheet` and shared
  tokens for colour, spacing, radii and typography.
- Every async operation exposes loading, error, success and offline states.

## Testing and deployment

- Jest + React Native Testing Library for unit/component tests.
- Maestro flows under `mobile/e2e/` for login, create album, capture, finish
  and photo review. Run `maestro test -e EMAIL=... -e PASSWORD=... e2e` against a
  development build with the API reachable.
- `mobile-ci.yml` runs typecheck, lint and Jest. Android/iOS store deployment
  options (EAS Build/Submit and Fastlane in GitHub Actions) are documented in
  `docs/DEPLOYMENT.md`; the repository does not sign or publish a release.
