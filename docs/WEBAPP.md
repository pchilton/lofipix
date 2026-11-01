# Webapp PWA (pwa.lofipix.app) — Storyboard

Offline-first capture loop on mobile. SolidJS + VitePWA, PGlite (IndexedDB
VFS), TanStack DB collections over PGlite, TanStack Query for
auth/uploads/non-synced state, OPFS for local image files. PostgreSQL rows
arrive as ElectricSQL shapes through the API proxy; local writes queue in a
PGlite outbox and post to the API. Binaries go to SeaweedFS via pre-signed
URLs (a later task).

## Development secure context and camera access

There are some locks (Web Locks API) and camera capture that require a secure context. 
Open `chrome://flags/`, find Insecure origins treated as secure, add in exact URL (no trailing slash) of:
http://192.168.1.15:5174


## Core loop

```text
Dashboard (view albums)
  → Create Album ─┐
  → open existing ┘
  → Take Photos → Finish Album (review / delete)
  → Submit (enqueue upload) → Dashboard (album on top, sync progress)
  → repeat
```

The PWA is a loop: view albums, create new ones, add photos, submit, back to
viewing. All steps work offline; sync happens when connectivity returns.

## Logged out user

If there is no session information, then the app prompts to be logged in.

### Welcome (`/`)

Authenticate before anything else. Works online; session persists offline.

- Fields: email, password (visibility toggle), Login button.
- Validation + auth errors inline; loading state on submit.
- Success → Dashboard. Offline with no session → blocked with "connect to sign in" state.

## Logged in user

The app is logged in. It should have user session information, as well as knowing what organisation the user belongs to.

### Dashboard (`/`)

Cut-down album view, reverse created order, sync progress visible.

- **Create Album card** (prominent, top):
  - Name (required, e.g. license plate), Notes (optional freetext, stored as paragraphs), Start button.
  - Notes contract (shared schema, see `docs/PHOTOS.md`): free text, paragraphs separated by a single blank line; line endings normalised to `\n`; an empty value stored as null.
  - If name already exists: replace Start with "Album already exists" note + emphasised "Review Existing" button → Finish Album for that album.
- **Most-recent album card**: mirrors Finish Album (thumbnail strip, counts, sync badge).
- **Album list**: older albums with thumbnails + per-photo sync state (device-only / queued / synced).
- Tap any album → Finish Album (review) or Take Photos (add more).

### Take Photos (`/albums/:id/capture`)

Full-screen camera capture for the current album.

- Camera view: live preview; graceful "no camera permission" state.
- Capture button (large, central); each shot writes to OPFS + a local PGlite row instantly.
- Thumbnail strip: last three captures.
- Finish button → Finish Album.
- Fully offline; every capture has local-success state, upload queued separately.

### Implemented skeleton and sync flow

The initial PWA implementation opens `idb://lofipix` in PGlite on startup and
hydrates four TanStack DB collections (`albums`, `photos`, `photo_locations`,
`storage_providers`) through `tanstack-db-pglite`. A Web Lock prevents two
tabs from opening the same database.

Reads: after sign-in the app starts one Electric `ShapeStream` per table at
`/api/sync/shapes/:table`. The API resolves the Better Auth session and active
organisation, injects the `organization_id` filter, the column projection and
the Electric secret, and streams the shape. `must-refetch` clears non-pending
local rows and replays the snapshot. Tombstones are synced, and live queries
filter `deletedAt == null`.

Writes: a local collection write sets the client-only `outboxNeeded` flag.
After the TanStack DB transaction settles, the row or changed columns are
written to the PGlite `outbox` with a UUIDv7 mutation id and the local
`version` as `baseVersion`. The sender coalesces pending edits per record and
posts one mutation per record at a time to `POST /api/sync/mutations`.

The API applies each mutation in its own transaction with a version check,
turns deletes into `deleted_at` tombstones, and records the mutation id in
`sync_mutations` so retries are idempotent. Applied rows/versions are written
back to PGlite; conflicts replace the local row with the server row and drop
the pending edit; rejected mutations become `dead`. Retries back off
exponentially; dead rows are retried once on the next app start.

A startup reconciliation pass catches the small crash window between a local
row write and its outbox insert by finding rows with `outboxNeeded = true`
that have no matching outbox entry.

`scripts/seed-demo.ts` creates two demo organisations, each with separate
users, albums and photo metadata. It only writes when passed `--apply`; set
`SEED_PASSWORD` before running `REGION=cholet bun run seed -- --apply` from
`scripts/`.

The capture screen requests camera access only after the user selects **Allow
camera**. Images are resized to a maximum width of 1280 px and compressed as
JPEG toward 300 KB, saved under `/photos/<photo-id>.jpg` in OPFS, and only
metadata is put in the local PGlite collections and synced. Other devices can
see the photo metadata but display **Device-only photo** when the bytes are
absent locally.

For manual browser smoke testing on the development machine, launch Chrome
with the matching `--unsafely-treat-insecure-origin-as-secure` origin. The PWA
provides all five routes (login/dashboard at `/`, capture, finish, and photo
review); the app itself still requests permission on the capture route.

The PGlite schema is managed with `drizzle-kit push` at build time. `bun run
snapshot` writes a versioned, empty data-dir archive to `public/pglite/`;
first run loads it, and `local_meta.schema_version` drives upgrades. VitePWA
installs updates with `registerType: 'prompt'`; the new service worker only
activates after the outbox is drained and all shapes are up to date, so the
old cached app keeps working offline.

## Finish Album (`/albums/:id/finish`)

Review everything on the device before submitting.

- Photo grid from local store; tap to review full-size.
- Delete with confirmation (local delete; tombstone propagates on sync if already uploaded).
- Status chips per photo: device-only → queued → synced.
- **Notes**: free text, editable on the device, paragraphs separated by a single blank line; saved with the album row and synced with it.
- **Add Photos** (emphasised when arriving via "Album already exists") → back to Take Photos.
- **Submit**: enqueues local photos for upload, returns to Dashboard with this album on top.

### Photo review (`/albums/:id/photos/:photoId`)

Full-size local (OPFS) or remote (pre-signed URL) image.

- Swipe/prev-next, delete with confirmation, back to Finish Album.

## Sync & upload behaviour

- Submits enqueue: OPFS bytes → SeaweedFS via pre-signed URLs (later task), metadata through the PGlite outbox and `POST /api/sync/mutations`.
- Album rows (name, notes) arrive through the Electric `albums` shape, so notes written offline are available on every device of the organisation.
- Dashboard and Finish Album show pending/error sync state; retries are automatic with exponential backoff.
- Tombstone deletes propagate so other clients converge.
- Every async operation exposes loading / error / success / offline states.

## UX notes

- Declarative SolidJS; no direct `fetch()` in components — typed API modules only.
- Forms via TanStack Form + Zod; all API responses / records validated with shared Zod schemas; strict TypeScript, no `any` in domain models.
- Ark UI + Tailwind ("Tark UI"), large touch targets, Solid-native transitions + CSS, Solid signals/stores for ephemeral UI state.


## Environment configuration

The PWA supports two environments:

- **Development**: port `5174` on the LAN IP only (localhost is rejected). Configuration is loaded from `pwa/src/lib/config.ts`:
  - `WEBSITE_URL`: `http://192.168.1.15:5173/`
  - `WEBAPP_URL`: `http://192.168.1.15:5174/`
  - `API_URL`: `http://192.168.1.15:5634/`

- **Production**: any other port/host (e.g. HTTPS on `pwa.lofipix.app`). Configuration is loaded from `pwa/src/lib/config.ts` with:
  - `WEBSITE_URL`: `https://www.lofipix.app/`
  - `WEBAPP_URL`: `https://pwa.lofipix.app/`
  - `API_URL`: `https://oceania.lofipix.app/`

The configuration is determined at runtime by inspecting `window.location` in `pwa/src/lib/config.ts`.
