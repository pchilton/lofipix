# Mobile app (`mobile/`) — Storyboard

Offline-first capture app for iOS and Android. It talks directly to the API;
there is no web/PWA build.

Stack: bare React Native CLI (no Expo runtime), React Navigation native-stack,
embedded SQLite via `@op-engineering/op-sqlite` managed by PowerSync, TanStack DB
collections over that database, Better Auth bearer tokens in
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
  → Submit (metadata syncs via PowerSync) → Dashboard (album on top, sync progress)
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
- **Submit**: marks the album updated; PowerSync uploads the metadata, then returns
  to Dashboard with this album on top.

### Photo review (`/albums/:id/photos/:photoId`)

Full-size local image from the app documents directory.

- Previous/Next controls, delete with confirmation, back to Finish Album.
- Other devices show a **Device-only photo** state when the bytes are absent.

## Local database

- SQLite is opened by `PowerSyncDatabase` from `@powersync/react-native` using
  the OP-SQLite adapter.
- The PowerSync `Schema` in `mobile/src/lib/db/schema.ts` defines the four synced
  tables (`albums`, `photos`, `photo_locations`, `storage_providers`). Rows use
  snake_case column names; `photos` and `photo_locations` have no
  `organization_id` (tenancy follows `albums`).
- PowerSync creates, versions and resets the local schema. There is no custom
  DDL, `LOCAL_SCHEMA_VERSION` gate or bundled migration file. Upgrading the
  schema recreates the local cache and resyncs from the server.
- TanStack DB collections in `mobile/src/lib/db/collections.ts` are the
  read/write layer; optimistic writes land in SQLite and the PowerSync upload
  queue.
- Synced rows are a cache. Pending writes live in PowerSync's durable upload
  queue.
- Signing out clears the PowerSync database, cached session and local photo bytes.

## Sync

Reads: after sign-in the connector calls `POST /api/sync/token` with the
Better Auth bearer token. The API requires exactly one active organisation and
signs a 5-minute JWT with `sub`, `aud: powersync` and `organization_id`.
PowerSync connects to `https://<region>.lofipix.app/powersync/`; the four
auto-subscribed Sync Streams filter `albums` and `storage_providers` directly on
`organization_id`, and `photos`/`photo_locations` join through `albums`.
Tombstones are synced and reads filter `deletedAt == null`.

Writes: TanStack DB mutations write optimistic rows to PowerSync SQLite. The
upload queue posts CRUD batches to `POST /api/sync/upload` with the local
`version` as `baseVersion`; PowerSync owns retry and queueing.

The API applies each upload in a transaction with a version check, resolves
tenancy through the parent album, turns deletes into `deleted_at` tombstones,
and returns `applied`, `conflict`, `rejected` or `already-applied`. Retries are
idempotent by natural key; a lost response can at most increment `version`
again. On `409`, the connector writes the server row locally, re-applies the
pending changed columns with the new version and lets PowerSync enqueue a fresh
upload. Rebase is silent; only a failed rebase shows a sync error.

The full JWT/upload/rebase contract is in `docs/POWERSYNC.md`.

## Photos

- Capture with the native camera.
- Compress to a maximum width of 1280 px as JPEG toward 300 KB (initial
  quality 0.82, quality floor 0.4).
- Compute a lowercase hex SHA-256 of the stored bytes.
- Save under `photos/<photo-id>.jpg` in the app documents directory.
- Insert only metadata into PowerSync SQLite; the upload queue syncs it.
- Bytes remain device-only; SeaweedFS upload is a later task.

## Authentication

- Better Auth bearer plugin on the API; the mobile client stores the token in
  `react-native-keychain`.
- The non-secret session profile (user id, email, name, active organisation) is
  cached in AsyncStorage.
- API token and upload requests send `Authorization: Bearer`.
- A `401`/`403` marks the session stale and prompts re-login; local cached data is
  retained until sign-out.

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
