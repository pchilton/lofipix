# Webapp PWA (pwa.lofipix.app) — Storyboard

Offline-first capture loop on mobile. React + VitePWA, PowerSync Web SDK
(OPFS-backed SQLite), TanStack DB for reactive collections, TanStack Query for
auth/uploads/non-synced state, OPFS for local image files. Syncs to the central
API / PostgreSQL via the PowerSync Service; binaries go to SeaweedFS via
pre-signed URLs.

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

## Pages

### 1. Login (`/login`)

Authenticate before anything else. Works online; session persists offline.

- Fields: email, password (visibility toggle), Login button.
- Validation + auth errors inline; loading state on submit.
- Success → Dashboard. Offline with no session → blocked with "connect to sign in" state.

### 2. Dashboard (`/`)

Cut-down album view, reverse created order, sync progress visible.

- **Create Album card** (prominent, top):
  - Name (required, e.g. license plate), Notes (optional freetext, stored as paragraphs), Start button.
  - If name already exists: replace Start with "Album already exists" note + emphasised "Review Existing" button → Finish Album for that album.
- **Most-recent album card**: mirrors Finish Album (thumbnail strip, counts, sync badge).
- **Album list**: older albums with thumbnails + per-photo sync state (device-only / queued / synced).
- Tap any album → Finish Album (review) or Take Photos (add more).

### 3. Take Photos (`/albums/:id/capture`)

Full-screen camera capture for the current album.

- Camera view: live preview; graceful "no camera permission" state.
- Capture button (large, central); each shot writes to OPFS + local SQLite row instantly.
- Thumbnail strip: last three captures.
- Finish button → Finish Album.
- Fully offline; every capture has local-success state, upload queued separately.

### 4. Finish Album (`/albums/:id/finish`)

Review everything on the device before submitting.

- Photo grid from local store; tap to review full-size.
- Delete with confirmation (local delete; tombstone propagates on sync if already uploaded).
- Status chips per photo: device-only → queued → synced.
- **Add Photos** (emphasised when arriving via "Album already exists") → back to Take Photos.
- **Submit**: enqueues local photos for upload, returns to Dashboard with this album on top.

### 5. Photo review (`/albums/:id/photos/:photoId`)

Full-size local (OPFS) or remote (pre-signed URL) image.

- Swipe/prev-next, delete with confirmation, back to Finish Album.

## Sync & upload behaviour

- Submits enqueue: OPFS bytes → SeaweedFS via pre-signed URLs, metadata via PowerSync upload / API POST.
- Dashboard and Finish Album show queue progress; retries automatic (TanStack Query retry + PowerSync retry/queue-depth).
- Tombstone deletes propagate so other clients converge.
- Every async operation exposes loading / error / success / offline states.

## UX notes

- Declarative React; no direct `fetch()` in components — typed API modules only.
- Forms via TanStack Form + Zod; all API responses / records validated with shared Zod schemas; strict TypeScript, no `any` in domain models.
- shadcn/ui + Tailwind, large touch targets, Motion for transitions, Zustand for ephemeral UI state.
