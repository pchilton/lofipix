# Mobile app (`mobile/`) — Storyboard

Offline-first capture app for iOS and Android. It talks directly to the API. There is no PWA build. The app is being rebuilt in small, verifiable increments from a fresh bare React Native CLI app. Each increment must continue to build and run on a connected Android device before the next screen or feature is added. The previous implementation is retained in `reference.mobile/` for reference only; it is not the active app or a source of buildable code.

Stack: bare React Native CLI (no Expo runtime), React Navigation native-stack,
embedded SQLite managed by PowerSync, Better Auth.

Mobile tooling: Node.js via ASDF (`mobile/.tool-versions`) and npm
(`mobile/package-lock.json`); `mobile/` is not part of the root Bun workspace.

## Native dependencies and setup order

Add and verify native modules incrementally, rather than installing the full target stack up front. After each dependency or native configuration change, build and launch the Android app on a connected device. Keep the initial empty app buildable throughout.

Target native modules:

- Camera: `react-native-vision-camera` (VisionCamera; not Apple's VisionKit framework).
- Photo files: `react-native-fs` for app-private document storage.
- Local relational data and sync: `@powersync/react-native` with its OP-SQLite adapter, `@op-engineering/op-sqlite`.
- Authentication tokens: `react-native-keychain`.
- Network state: `@react-native-community/netinfo`.
- Session profile storage: `@react-native-async-storage/async-storage`.
- Image resize/compression: `@bam.tech/react-native-image-resizer`.
- SVG rendering: `react-native-svg`.

Suggested increments:

1. Establish the fresh app build and launch loop on Android (see `docs/ANDROID.md`).
2. Add navigation and one simple screen at a time, rebuilding on device after each increment.
3. Add VisionCamera, Android camera permission configuration, and a camera permission/preview screen; verify permission denial and grant on device before wiring capture.
4. Add app-private filesystem handling and image resize/compression; capture a test image, save it under the app documents directory, and verify it can be reopened. Never store photo bytes in SQLite.
5. Add OP-SQLite and PowerSync; define the local schema and initialize the database, then verify a local write survives app restarts before adding remote sync.
6. Add the PowerSync connector, auth and upload flow against the API, then verify offline writes and later sync on device.

Use the installation and Android configuration instructions for each native module's version compatible with the React Native version in `mobile/package.json`. Rebuild the native app after installing or changing a native dependency; Metro reload alone does not include new native code. Keep Android permissions minimal: request camera access only when the capture screen needs it, and do not request broad media or filesystem access for app-private files.

## Photo and local data boundaries

- VisionCamera provides capture; it is not the photo filesystem and is distinct from the iOS VisionKit framework.
- Store compressed JPEG bytes in app-private documents storage (for example `photos/<photo-id>.jpg`) via `react-native-fs`. Keep only metadata and the relative file path in SQLite.
- Use PowerSync's OP-SQLite-backed database as the local relational cache and durable pending-write queue. Define tables with the PowerSync `Schema`; do not create a second SQLite database or custom DDL/migration layer.
- Treat filesystem writes and SQLite metadata writes as separate operations: only create a photo row after its file has been written successfully, and clean up the file if row creation fails. A synced row on another device does not imply its photo bytes are present there.


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

- On login, check camera access and request permission; if it has been denied,
  direct the user to device Settings.
- **Settings** opens the Settings page from the Dashboard.
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

### Settings

Account settings opened from Dashboard. The **Log out** button is anchored at the
bottom of the page; it revokes the Better Auth session when online, clears the
local Keychain token, and returns to Welcome.

### Take Photos (`/albums/:id/capture`)

Full-screen native camera for the current album.

- Camera preview; check the granted permission and show loading, denied and
  unavailable states.
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

- Native auth requests send the registered `Origin: lofipix://` header required by
  Better Auth's origin validation.
- Email/password sign-in captures Better Auth's `set-auth-token` response header
  and securely stores the bearer token in `react-native-keychain`.
- The saved email is the Keychain account name and restores the dashboard on
  later launches.
- Authenticated API requests send `Authorization: Bearer`.
- Log out invalidates the Better Auth session when possible and always clears the
  local Keychain token.
- Failed sign-in requests log their method, URL and error in development only;
  credentials and bearer tokens are never logged.
- A `401`/`403` marks the session stale and prompts re-login; local cached data is
  retained until sign-out.

## Environment configuration

The app reads environment variables at native build time with `react-native-config`.
`mobile/.env.development` is selected for Debug builds and
`mobile/.env.production` for Release builds on Android and iOS. The values are
exposed to TypeScript through `mobile/src/config/environment.ts` as
`mobileEnvironment.API_URL`, `mobileEnvironment.WEB_URL`, and
`mobileEnvironment.POWERSYNC_URL`.

These files contain public endpoint URLs, not secrets. Values are embedded in
builds, so do not put credentials or private keys in them.

- **Development:** API `http://192.168.1.15:5634/`, website
  `http://192.168.1.15:5173/`, PowerSync
  `http://192.168.1.15:5677/`. Use the LAN IP; Android emulators may need
  `10.0.2.2` mapped to the host.
- **Production:** API `https://oceania.lofipix.app/`, website
  `https://www.lofipix.app/`, PowerSync
  `https://oceania.lofipix.app/powersync/`.

For iOS, run `pod install` from `mobile/ios/` after adding or updating native
packages. The native app has no web build and does not use a PWA domain.

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
