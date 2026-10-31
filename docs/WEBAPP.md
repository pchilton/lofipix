# Webapp PWA (pwa.lofipix.app) — Storyboard

Offline-first capture loop on mobile. SolidJS + VitePWA, PowerSync Web SDK
(OPFS-backed SQLite), TanStack DB for reactive collections, TanStack Query for
auth/uploads/non-synced state, OPFS for local image files. Syncs to the central
API / PostgreSQL via the PowerSync Service; binaries go to SeaweedFS via
pre-signed URLs.

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
- Capture button (large, central); each shot writes to OPFS + local SQLite row instantly.
- Thumbnail strip: last three captures.
- Finish button → Finish Album.
- Fully offline; every capture has local-success state, upload queued separately.

### Implemented skeleton and PowerSync flow

The initial PWA implementation uses TanStack DB collections over the
PowerSync Web SDK. The SQLite `albums` and `photos` collections load into
reactive TanStack queries. Local collection writes are applied to SQLite with
`PowerSyncTransactor`; PowerSync batches queued CRUD operations to
`POST /api/sync/upload`. The API validates operation shape and row fields with
shared Zod schemas, checks the session's active organisation and album
ownership, and translates deletes into `deleted_at` tombstones.

`GET /api/sync/token` issues a short-lived JWT with `sub`, `aud` and
`organization_id`, after checking the Better Auth session and membership. Every
PowerSync stream is filtered using `auth.parameter('organization_id')`; photos
and photo locations are scoped through their album join. `scripts/seed-demo.ts`
creates two demo organisations, each with separate users, albums and photo
metadata. It only writes when passed `--apply`; set `SEED_PASSWORD` before
running `REGION=cholet bun run seed -- --apply` from `scripts/`.

The capture screen requests camera access only after the user selects **Allow
camera**. Images are resized to a maximum width of 1280 px and compressed as
JPEG toward 300 KB, saved under `/photos/<photo-id>.jpg` in OPFS, and only
metadata is put in the local SQLite collection and uploaded. Other devices can
see the photo metadata but display **Device-only photo** when the bytes are
absent locally.

For manual browser smoke testing on the development machine, launch Chrome
with the matching `--unsafely-treat-insecure-origin-as-secure` origin. The PWA
provides all five routes (login/dashboard at `/`, capture, finish, and photo
review); the app itself still requests permission on the capture route.

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

- Submits enqueue: OPFS bytes → SeaweedFS via pre-signed URLs, metadata via PowerSync upload / API POST.
- Album rows (name, notes) travel through the `global_albums` PowerSync stream, so notes written offline are available on every device of the organisation.
- Dashboard and Finish Album show queue progress; retries automatic (TanStack Query retry + PowerSync retry/queue-depth).
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
