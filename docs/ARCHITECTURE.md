# Technology stacks

Target stack for `www/`, `pwa/`, and `api/`. The central API in `api/` backed by
PostgreSQL is the source of truth; clients are offline-capable views over it.

## Website (/www)

Public website: product description, organisation signup, billing, account management.

- UI Framework & Build Tools: React built with Vite under a unified Bun workspace monorepo structure. Components are declarative.
- Routing & SSR: TanStack Router / TanStack Start managing type-safe client-side routes, layout-level auth guards, and static export.
- Design System: shadcn/ui + Tailwind CSS.
- Data Fetching: TanStack Query for data fetching and caching with automatic retry logic. Used for auth, uploads, and non-synced API state. No direct `fetch()` calls in components; use typed API modules.
- Forms: TanStack Form + Zod.
- Client State: Zustand for local UI state.
- Animation: Motion JS.
- Authentication Hooks: Better Auth client handles login states, redirection flows, and cookie sessions.
- Validation: Every API response consumed here has a Zod schema (shared from `packages/db/models/`). TypeScript strictly; no `any` in domain models.
- Async UX: Every async operation has explicit loading, error, success, and offline states.
- Testing: Vitest + Playwright.
- Local Data Storage: None. Interacts with the API for all persistence.

## PWA Web Stack (/pwa)

Local-first, offline-first application for capturing photos.

- UI Framework & Build Tools: React built with Vite + VitePWA under a unified Bun workspace monorepo structure. Components are declarative.
- Routing: TanStack Router managing type-safe SPA pathways and layout-level auth guards.
- Design System: shadcn/ui + Tailwind CSS.
- Local Database: SQLite in the browser via the PowerSync Web SDK with OPFS-backed SQLite.
- Sync Engine: PowerSync for offline-first data synchronization against the PowerSync Service (PostgreSQL-to-SQLite sync). Handles retries, queue depth, and accepted/rejected operations.
- Reactivity Interface: TanStack DB for reactive UI collections over the local SQLite store and synchronization state.
- Non-synced State: TanStack Query for auth, uploads, and non-synced API state, with automatic retry logic. No direct `fetch()` calls in components; use typed API modules.
- Forms: TanStack Form + Zod.
- Client State: Zustand for local UI state.
- Animation: Motion JS.
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
- Soft Deletes: Tombstone / soft-delete rows on synced tables so PowerSync clients converge correctly.
- Validation: Every API response and database record has a Zod schema, shared from `packages/db/models/`.
- Authentication Backend: Better Auth (config in `packages/db/auth.ts`, tables in the `auth` schema). See `docs/AUTHENTICATION.md` for methods and plugins.
- Authorization Engine: enforced via the Better Auth organisation plugin (organisation / member tables in the `auth` schema). See `docs/AUTHENTICATION.md`.
- Data Replication: PowerSync Service sitting alongside PostgreSQL to track changes and serve Postgres-to-SQLite sync deltas to PWA clients.
- Background Jobs: pgmq (Postgres-hosted queue) for async work such as image conversion and sync outbox processing.
- Reverse Proxy: Nginx as a high-performance proxy handling TLS termination (HTTPS) at the edge.
- Storage: SeaweedFS (S3-compatible object storage) with path buckets behind nginx. Private buckets. All uploads/downloads use API-generated pre-signed URLs.
- Observability: Instrumented for Uptrace (see `docs/UPTRACE.md`).

## The Shared Core Workspace (packages/db)

- Single Source of Truth: local Drizzle table definitions plus their Zod schemas in `packages/db/models/`, imported by API and clients — do not re-define them locally. Type-only Better Auth proxies live in `packages/db/external/` (no table definitions, so `push` never touches the `auth` schema).
- Validation Mapping: `drizzle-zod` translates table columns into Zod schema parsers shared across all apps. Every database record and API response has a schema.
- Strict Types: TypeScript strictly; no `any` in domain models.
- Soft Deletes: Tombstone columns (e.g. `deleted_at` / `is_deleted`) on synced tables.

## Frontend conventions (www/ + pwa/)

These rules apply to all React clients:

- Declarative React components only.
- No direct `fetch()` calls in components; use typed API modules.
- TanStack Query for server state (auth, uploads, non-synced API state) with automatic retry.
- TanStack DB for reactive UI collections (PWA local + synced data).
- TanStack Router / TanStack Start for routing.
- TanStack Form + Zod for forms.
- Zustand for ephemeral client state; Motion JS for animation; shadcn/ui + Tailwind for UI.
- Every async operation surfaces loading, error, success, and offline states.

# Communication channels

Web App ↔ Server API Gateway

- Protocol: Standard HTTPS request/response.
- Auth State: Cookie-based user sessions managed by Better Auth.
- Data Access: Typed API modules validated with shared Zod schemas; TanStack Query handles caching and retry.
- Xero Connection: Clicking "Connect Xero" redirects to Xero's authorization screen. On callback success, Hono queries Xero's connection API, saves the valid multi-tenant profile mappings into the account's JSONB metadata column via Drizzle, and routes the user back to the SPA.

PWA Read-Path Data Sync (Server → PWA)

- Protocol: PowerSync sync deltas from the PowerSync Service (Postgres-to-SQLite) into the PowerSync Web SDK's OPFS-backed SQLite instance.
- Data Boundary Control: Clients authenticate (Better Auth session); Hono checks organisation membership via the Better Auth organisation plugin and exposes only the permitted sync window (e.g. rows for the user's organisations). Deletes arrive as tombstone rows.
- Local Reactivity: TanStack DB wraps the local SQLite collections to provide live, reactive UI updates, including offline states.

PWA Write-Path Mutations (PWA → Server)

- Protocol: PowerSync uploads for synced collections (with accepted/rejected operation handling, retries, queue-depth observability), plus unidirectional HTTPS POSTs for non-synced operations (auth, uploads, one-off mutations).
- Path Flow: Status mutations and account changes resolve in Hono against PostgreSQL (the source of truth) and fan back out through PowerSync deltas.
- Binary Uploads: Images are written to OPFS locally, then uploaded to SeaweedFS via API-issued pre-signed URLs; conversion metadata (dimensions, page number, duration) is tracked as a custom Uptrace span.

Image / Object Storage

- Protocol: HTTPS to SeaweedFS via nginx reverse proxy, using pre-signed URLs generated by the Hono API.
- Clients never hold S3 credentials. OPFS holds the local PWA copy; SeaweedFS holds the canonical object.
