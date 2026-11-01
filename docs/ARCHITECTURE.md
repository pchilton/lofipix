# Technology stacks

Target stack for `www/`, `pwa/`, and `api/`. Both clients are SolidJS. The central API in `api/` backed by
PostgreSQL is the source of truth; the PWA client is local-first, offline-capable.

## Website (/www)

Public website: product description, organisation signup, billing, account management.
A plain static site: no PWA, no service worker, no ElectricSQL sync, no local persistence.

- UI Framework & Build Tools: SolidJS built with Vite under a unified Bun workspace monorepo structure. Components are declarative.
- Routing: TanStack Router (Solid) managing type-safe client-side routes, layout-level auth guards, and static export. No TanStack Start / SSR.
- Design System: Ark UI (`@ark-ui/solid`) headless components styled with Tailwind CSS ("Tark UI").
- Data Fetching: TanStack Query (`@tanstack/solid-query`) for data fetching and caching with automatic retry logic. Used for auth and API state. No direct `fetch()` calls in components; use typed API modules.
- Forms: TanStack Form (Solid) + Zod.
- Client State: Solid signals and stores for local UI state.
- Animation: Solid-native transitions (`TransitionGroup` / `Presence`) + CSS transitions.
- Authentication Hooks: Better Auth client handles login states, redirection flows, and cookie sessions.
- Validation: Every API response consumed here has a Zod schema (shared from `packages/db/models/`). TypeScript strictly; no `any` in domain models.
- Async UX: Every async operation has explicit loading, error, success, and offline states.
- Testing: Vitest + Playwright.
- Local Data Storage: None. Interacts with the API for all persistence.

## PWA Web Stack (/pwa)

Local-first, offline-first application for capturing photos.

- UI Framework & Build Tools: SolidJS built with Vite + VitePWA under a unified Bun workspace monorepo structure. Components are declarative.
- Routing: TanStack Router (Solid) managing type-safe SPA pathways and layout-level auth guards.
- Design System: Ark UI (`@ark-ui/solid`) headless components styled with Tailwind CSS ("Tark UI").
- Local Database: PGlite (PostgreSQL compiled to WebAssembly) persisted with the IndexedDB VFS (`idb://lofipix`). OPFS AHP is not used because it requires a worker and is unsupported in Safari; photo bytes remain in OPFS.
- Sync Engine: ElectricSQL streams PostgreSQL table shapes through an authenticated API proxy. A PGlite-backed outbox sends local mutations to `POST /api/sync/mutations` with version checks and server-side idempotency.
- Reactivity Interface: TanStack DB (`@tanstack/solid-db`) collections backed by PGlite through `tanstack-db-pglite`, hydrated by the Electric shape stream. TanStack DB is the reactive layer, not the database or sync engine.
- Non-synced State: TanStack Query for auth, uploads, and non-synced API state, with automatic retry logic. No direct `fetch()` calls in components; use typed API modules.
- Forms: TanStack Form (Solid) + Zod.
- Client State: Solid signals and stores for local UI state.
- Animation: Solid-native transitions (`TransitionGroup` / `Presence`) + CSS transitions.
- Binary Files: OPFS for local image files. Remote originals live in SeaweedFS (S3-compatible); the API issues pre-signed URLs — clients never hold S3 credentials.
- Soft Deletes: Tables use tombstones / soft-delete rows so deletes propagate through sync instead of disappearing.
- Validation: Every API response and database record has a Zod schema. TypeScript strictly; no `any` in domain models.
- Async UX: Every async operation has explicit loading, error, success, and offline states.
- Authentication Hooks: Better Auth client handles login states, redirection flows, and cookie sessions.
- Testing: Vitest + Playwright.

## The Server/API Stack (/api)

The central coordinator and source of truth: manages master records, handles auth,
filters client sync windows, hosts the application gateway, and issues storage credentials.

- Core API Gateway: Hono running natively on the Bun runtime. This is the source of truth for all domain data.
- Data Persistence: PostgreSQL as the source of truth.
- Database Management: Drizzle ORM for application tables in `public` (schema-as-source-of-truth, synced with `drizzle-kit push`); Better Auth syncs its own tables into the `auth` schema (see `docs/AUTHENTICATION.md`).
- Soft Deletes: Tombstone / soft-delete rows on synced tables so Electric shapes and PWA clients converge correctly.
- Validation: Every API response and database record has a Zod schema, shared from `packages/db/models/`.
- Authentication Backend: Better Auth (config in `packages/db/auth.ts`, tables in the `auth` schema). See `docs/AUTHENTICATION.md` for methods and plugins.
- Authorization Engine: enforced via the Better Auth organisation plugin (organisation / member tables in the `auth` schema). See `docs/AUTHENTICATION.md`.
- Data Replication: ElectricSQL sitting alongside PostgreSQL, tracking WAL changes and serving table shapes to the API proxy for PWA clients.
- Background Jobs: pgmq (Postgres-hosted queue) for async work such as image conversion.
- Reverse Proxy: Nginx as a high-performance proxy handling TLS termination (HTTPS) at the edge.
- Storage: SeaweedFS (S3-compatible object storage) with path buckets behind nginx. Private buckets. All uploads/downloads use API-generated pre-signed URLs.
- Observability: Instrumented for Uptrace (see `docs/UPTRACE.md`).

## The Shared Core Workspace (packages/db)

- Single Source of Truth: local Drizzle table definitions plus their Zod schemas in `packages/db/models/`, imported by API and clients — do not re-define them locally. Type-only Better Auth proxies live in `packages/db/external/` (no table definitions, so `push` never touches the `auth` schema).
- Validation Mapping: `drizzle-zod` translates table columns into Zod schema parsers shared across all apps. Every database record and API response has a schema.
- Strict Types: TypeScript strictly; no `any` in domain models.
- Soft Deletes: Tombstone columns (e.g. `deleted_at` / `is_deleted`) on synced tables.

## Frontend conventions (www/ + pwa/)

These rules apply to all SolidJS clients (`www/` and `pwa/`):

- Declarative SolidJS components only.
- No direct `fetch()` calls in components; use typed API modules.
- TanStack Query for server state (auth, uploads, non-synced API state) with automatic retry.
- TanStack DB for reactive UI collections (PWA local + synced data).
- TanStack Router (Solid) for routing.
- TanStack Form + Zod for forms.
- Solid signals/stores for ephemeral client state; Solid-native transitions + CSS for animation; Ark UI + Tailwind for UI.
- Every async operation surfaces loading, error, success, and offline states.

# Communication channels

Web App ↔ Server API Gateway

- Protocol: Standard HTTPS request/response.
- Auth State: Cookie-based user sessions managed by Better Auth.
- Data Access: Typed API modules validated with shared Zod schemas; TanStack Query handles caching and retry.
- Xero Connection: Clicking "Connect Xero" redirects to Xero's authorization screen. On callback success, Hono queries Xero's connection API, saves the valid multi-tenant profile mappings into the account's JSONB metadata column via Drizzle, and routes the user back to the SPA.

PWA Read-Path Data Sync (Server → PWA)

- Protocol: ElectricSQL shape streams (`/v1/shape`) proxied by Hono at `GET/POST /api/sync/shapes/:table`. The API injects the organisation filter, column projection and Electric secret; clients never hold an Electric URL or secret.
- Data Boundary Control: Clients authenticate with a Better Auth cookie session; Hono resolves the active organisation and streams only rows matching `organization_id`. Deletes arrive as tombstone rows and are filtered by `deleted_at is null` in live queries.
- Local Reactivity: Electric messages are written into PGlite through `tanstack-db-pglite`; TanStack DB collections provide live, reactive UI updates, including offline states.

PWA Write-Path Mutations (PWA → Server)

- Protocol: A PGlite outbox posts batched mutations to `POST /api/sync/mutations` with a client mutation id, `base_version` and payload. Retries use exponential backoff; the server records mutation ids in `sync_mutations` for idempotency.
- Path Flow: Mutations resolve in Hono against PostgreSQL with per-row version checks, then fan back out through Electric shapes. Conflicts replace the local row with the server row; rejected mutations become `dead`.
- Binary Uploads: Images are written to OPFS locally, then uploaded to SeaweedFS via API-issued pre-signed URLs; conversion metadata (dimensions, page number, duration) is tracked as a custom Uptrace span.

Image / Object Storage

- Protocol: HTTPS to SeaweedFS via nginx reverse proxy, using pre-signed URLs generated by the Hono API.
- Clients never hold S3 credentials. OPFS holds the local PWA copy; SeaweedFS holds the canonical object.
