# PWA (`pwa/`)

The PWA is the browser version of the LoFi Pix capture app. It exists so users
who cannot install the native app (for example because they do not have access
to a store build) can still run the offline capture loop from a browser. It is
installable from the browser and uses the browser's own storage and camera APIs.

This document covers the shell (prompt 0028), authenticated PowerSync sync
(prompt 0029) and the offline capture loop with OPFS photo bytes (prompt 0030).

## Relationship to the other clients

| Client | Purpose | Stack |
| --- | --- | --- |
| `www/` | Public website, organisation administration and billing | React static site, cookie sessions, no local persistence |
| `pwa/` | Installable offline-first capture app in the browser | React static SPA + `vite-plugin-pwa`, Better Auth cookie sessions, PowerSync web + TanStack DB, OPFS photo bytes |
| `mobile/` | Native iOS/Android capture app | bare React Native, PowerSync native SQLite, app documents storage |

`pwa/` is not a second website. `www/` remains the place for marketing,
registration and administration. The PWA follows the capture loop in
`docs/MOBILE.md`; `mobile/` remains the reference implementation for native
camera and storage behaviour.

## Stack

- React 19 + Vite, TypeScript strict, static single-page app. No SSR, no SSG and
  no server runtime.
- TanStack Router, TanStack Query and TanStack Form; Zod for validation.
- ShadCN components, Tailwind CSS v4 and icons from `packages/ui`
  (`@lofipix/ui`). Follow `docs/SHADCN.md` and `docs/ICONS.md`.
- PWA support from `vite-plugin-pwa` (Workbox `generateSW`).
- Better Auth React client with HTTP-only cookie sessions.
- `@powersync/web` (WA-SQLite/OPFS when available), TanStack DB collections and
  the shared Zod models from `packages/db/models/`.
- Bun for scripts and package management. `pwa/` is part of the root Bun
  workspace.

## Folder structure

```text
pwa/
├── public/                 # icon source, generated PWA icons, static assets
├── src/
│   ├── components/         # shell, sync badge, session gate, capture form
│   │   └── photos/         # create-album form and photo thumbnail
│   ├── config/             # typed environment configuration
│   ├── lib/                # auth, session, API and PowerSync modules
│   │   ├── db/             # schema, collections, connector, sync state
│   │   └── photos/         # camera, compression, hashing, OPFS and mutations
│   ├── routes/             # Welcome, Dashboard, Settings
│   │   └── albums/         # create, capture, finish and photo review
│   ├── index.css           # Tailwind + shared @lofipix/ui theme
│   ├── main.tsx            # React root and QueryClient
│   ├── router.tsx          # router and root layout
│   └── vite-env.d.ts       # Vite, PWA and icon ambient types
├── index.html
├── package.json
├── pwa-assets.config.ts    # icon generation preset
├── tsconfig.json
└── vite.config.ts
```

## Commands

Run from `pwa/`:

| Command | Purpose |
| --- | --- |
| `bun run dev` | Vite dev server on `http://0.0.0.0:5174` with HMR |
| `bun run build` | Production static build in `pwa/dist/` |
| `bun run preview` | Serve `pwa/dist/` on `http://0.0.0.0:4174` |
| `bun run typecheck` | TypeScript check |
| `bun run test` | Vitest unit tests (connector conflicts, compression, hashing, OPFS, rows) |
| `bun run icons:generate` | Regenerate PWA PNGs from `public/icon.svg` |
| `bun run powersync:assets` | Copy the PowerSync worker assets into `public/@powersync` (also runs before dev/build) |

The production service worker and manifest are checked with
`bun run build && bun run preview`, not with the dev server. The service worker
is disabled in `bun run dev` so it cannot intercept Vite's transformed
`index.html` and break React Fast Refresh. Every page and UI flow can be
developed on the dev server; test install/offline behaviour against the preview
build.

## Environment configuration

Environment values are resolved at **build time** by Vite modes and exposed
through `src/config/environment.ts` as `pwaEnvironment`. The files contain
public endpoint URLs only; never put secrets in them.

| Variable | Development (`bun run dev`) | Production (`bun run build`) |
| --- | --- | --- |
| `VITE_API_URL` | `http://192.168.1.15:5634/` | `https://oceania.lofipix.app/` |
| `VITE_WEB_URL` | `http://192.168.1.15:5173/` | `https://www.lofipix.app/` |
| `VITE_POWERSYNC_URL` | `http://192.168.1.15:5677/` | `https://oceania.lofipix.app/powersync/` |

- `pwa/.env.development` is used by `bun run dev`.
- `pwa/.env.production` is used by `bun run build`.
- Keep the trailing slash; typed API helpers resolve paths against
  `API_URL`.
- Both files are committed because the values are public. `pwa/.gitignore` has
  explicit exceptions for them.
- Do not read the hostname at runtime and do not add a runtime config file; the
  build mode is the single source of environment selection.

## Build model and hosting

The PWA is a static SPA. `bun run build` writes `dist/index.html`, hashed
assets, the manifest and the service worker. Client-side routes must fall back
to `index.html` on the host.

The intended production origin is `https://pwa.lofipix.app`, deployed to
Cloudflare static assets by a future GitHub Action. That deployment is out of
scope for 0028; when it lands it needs the same SPA fallback as `www/` and the
headers required by PowerSync web.

Production cookies are scoped to `.lofipix.app`, so the PWA shares the website
session. The PWA origins `https://pwa.lofipix.app`, `http://192.168.1.15:5174`
and `http://192.168.1.15:4174` are listed in the API CORS allowlist and Better
Auth `trustedOrigins`.

## PWA support

`vite-plugin-pwa` generates the manifest and Workbox service worker.

- `registerType: "prompt"`: a new deployment shows the in-app update banner
  (`src/components/PwaUpdatePrompt.tsx`) instead of reloading mid-work.
- Precache: built JS, CSS, HTML, icons, fonts and the four WA-SQLite WASM
  builds. `maximumFileSizeToCacheInBytes` is raised to 5 MiB so the largest
  WASM file can be stored; the full install is roughly 9 MB. The WASM files
  must be precached because the PowerSync database worker cannot open the local
  database offline otherwise.
- Navigation fallback: unknown routes serve `/index.html` so TanStack Router
  handles them.
- No API or sync caching: `/api/*` and `/powersync/*` are excluded from the
  navigation fallback and have no runtime caching rules. The service worker
  must never serve stale API or sync responses.
- The manifest declares `name: "LoFi Pix"`, `short_name: "lofipix"`,
  `display: "standalone"`, `start_url: "/"` and the 192/512/maskable icons.

### Icons

- `public/icon.svg` is the single source asset.
- `bun run icons:generate` uses `@vite-pwa/assets-generator` with the
  `minimal2023Preset` from `pwa-assets.config.ts`.
- Generated files (`pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`,
  `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`,
  `favicon.ico`) are committed; do not edit them by hand.

## Capture loop

Routes:

| Route | Purpose |
| --- | --- |
| `/dashboard` | Album list, per-album photo counts and the Create Album card |
| `/albums/new` | Full-page Create Album form |
| `/albums/:albumId/capture` | Camera preview or file fallback, capture button, last three thumbnails |
| `/albums/:albumId/finish` | Photo grid, notes editor, delete, Add Photos and Submit |
| `/albums/:albumId/photos/:photoId` | Full-size OPFS review with previous/next and delete |

All routes require the session gate.

- **Create Album**: the name is trimmed and required. A case-insensitive match
  against live albums shows "Album already exists" with a Review Existing
  action instead of Start. Notes use the shared `normalizeNotes` transform:
  `\n` line endings, a single blank line between paragraphs, and `null` when
  empty.
- **Camera**: `getUserMedia({ video: { facingMode: { ideal: "environment" } } })`
  is requested when the Capture screen mounts. Loading, denied, unavailable and
  in-use errors are explicit. The camera stream stops on unmount.
- **Fallback**: `<input type="file" accept="image/*" capture="environment">` is
  always available. It works when the camera is denied, unavailable, or the
  browser only supports file capture.
- **Compression**: images are drawn to a canvas/`OffscreenCanvas` with EXIF
  orientation applied, resized to a maximum width of 1280 px, and encoded as
  JPEG. The encoder starts at quality 0.82 and steps to 0.4; if still above the
  300 KB target it reduces the width and repeats. `image_quality` stores the
  chosen quality as an integer 1–100.
- **Checksum and storage**: a lowercase hex SHA-256 is computed with Web Crypto,
  then bytes are written to OPFS at `photos/{photoId}.jpg`, read back and
  hash-verified before the `photos` row is inserted. A failed insert removes the
  file.
- **Device provider**: the first capture creates one `opfs` provider per
  organisation in the local database, with `external_id` set to a persisted
  UUIDv7 device id, `label` "This browser", and
  `config = { "platform": "web", "deviceName": "Browser", "userAgent": ... }`.
- **Location**: every capture creates a `photo_locations` row with the provider
  id and `object_key` `photos/{photoId}.jpg`. Metadata syncs; the bytes stay in
  OPFS.
- **Delete**: deleting a photo removes the local `photos` and
  `photo_locations` rows, which PowerSync uploads as deletes and the API stores
  as tombstones. The OPFS file is then removed. Reads filter tombstones.
- **Status chips**: the PWA does not expose per-row sync state, so photo chips
  follow the global sync state: Synced when the sync engine reports a completed
  sync, Queued while connecting/uploading, and Device-only while offline or in
  error.
- **Sign-out**: clears the PowerSync database, cached profile and the whole
  `photos/` OPFS directory.

Known browser limits: installed iOS camera behaviour differs from Safari,
background capture is not guaranteed, and thumbnail rendering is slower than
the native app. OPFS and the service worker require a secure context; see
Development on Android Chrome.

## Authentication and offline start

- Sign-in uses the Better Auth React client at `VITE_API_URL` with
  `credentials: "include"`. The session cookie is HTTP-only; no bearer token is
  stored in browser storage.
- After a successful sign-in, a non-secret profile (user id, name, email and
  active organisation id) is saved in `localStorage`.
- Offline launches open the dashboard from that cached profile and the local
  PowerSync database. A later `401`/`403` marks the session stale, prompts
  re-login and leaves local work intact.
- Sign-out requires a connection. It revokes the Better Auth session, clears the
  cached profile and clears the PowerSync database. The button is disabled while
  offline.

## Sync

- `@powersync/web` opens the local database with `dbFilename: lofipix-pwa.db`
  and `vfs: "auto"`, using OPFS when the browser provides it and falling back to
  in-memory storage otherwise.
- The PowerSync `Schema` mirrors the four synced tables (`albums`, `photos`,
  `photo_locations`, `storage_providers`). TanStack DB collections read those
  tables; the Dashboard uses live queries and sorts/filters in the client.
- `POST /api/sync/token` is called with the cookie session. The connector strips
  the trailing slash from `POWERSYNC_URL` because the service rejects endpoints
  ending in `/`.
- Uploads go to `POST /api/sync/upload` with `opId`, `clientId`, changed columns
  and `baseVersion`. Every table tracks the previous `version`, so a delete can
  supply the version it is deleting.
- The upload queue is processed one entry at a time. A `409` conflict records
  the server version for that row and retries the same pending operation with
  that version as `baseVersion`; the local row converges when the server row is
  downloaded. The user only sees a sync error if the retry limit is exhausted.
- The header badge reports loading, connecting, syncing, synced, offline and
  error states. Reads and writes never depend on the network.
- `storage_providers.encrypted_data` is not in the PowerSync schema and is not
  selected by the sync stream; it never reaches the browser.

## Development on Android Chrome

The PWA needs a **secure context** for the service worker and OPFS. Production
is HTTPS. Development is served over plain HTTP on the LAN, so the Android
Chrome instance must treat the dev origin as secure:

1. Open `chrome://flags/#unsafely-treat-insecure-origin-as-secure` on the
   device.
2. Add `http://192.168.1.15:5174` (dev) and `http://192.168.1.15:4174`
   (preview) to the list.
3. Set the flag to **Enabled** and relaunch Chrome.
4. Open `http://192.168.1.15:5174` for development, or
   `http://192.168.1.15:4174` after `bun run build` for service-worker and
   offline testing.

If an earlier build registered a dev service worker, unregister it once in
Chrome DevTools → Application → Service Workers (or clear site data). The dev
server no longer registers one, and `src/main.tsx` unregisters any existing
service worker when running in development.

The PWA calls the HTTP LAN API directly at `http://192.168.1.15:5634/`; there is
no Vite proxy. Both dev origins (`5174` and `4174`) are in the API CORS
allowlist and Better Auth trusted origins.

This flag is a development-only workaround. It is not required in production
and must not be baked into application code or documentation as the normal
deployment model.

## Camera limits

Browsers do not offer the same camera behaviour as the native app. The PWA:

- prefers `navigator.mediaDevices.getUserMedia()` with a live preview;
- falls back to `<input type="file" accept="image/*" capture="environment">`
  when `getUserMedia` is unavailable or denied;
- requests camera permission only when the Capture screen opens;
- documents installed-iOS differences from Safari, the lack of guaranteed
  background capture, and lower thumbnail performance than native;
- compresses with canvas/`OffscreenCanvas` to at most 1280 px width, JPEG from
  quality 0.82 toward 300 KB with a 0.4 floor;
- stores bytes in OPFS at `photos/{photoId}.jpg` with a Web Crypto SHA-256.

## Roadmap

| Prompt | Scope |
| --- | --- |
| `prompts/0028-pwa-reintroduced.done.md` | Shell, PWA support, environment, icons, docs (this document) |
| `prompts/0029-pwa-sync.done.md` | Cookie auth, PWA origins, `@powersync/web` with WA-SQLite/OPFS, TanStack DB, Dashboard reads |
| `prompts/0030-pwa-photo-capture.done.md` | Camera capture, compression, SHA-256, OPFS photo bytes, `opfs` provider with `config.platform: "web"`, capture-loop screens |

## Verification

From `pwa/`:

```sh
bun run typecheck
bun run test
bun run build
```

The build output must contain `dist/index.html`, `dist/manifest.webmanifest`,
`dist/sw.js`, the 192/512/maskable icons and the Workbox runtime.
