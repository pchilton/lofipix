# Technology stacks

Target stack for `www/`, `mobile/`, and `api/`. The website is React; the mobile
app is bare React Native. The central API in `api/` backed by PostgreSQL is the
source of truth; the mobile client is local-first and offline-capable.

## Website (`/www`)

Public website: product description, organisation signup, billing, account management.
A plain static site: no service worker, no sync engine, no local persistence.

- UI Framework & Build Tools: React + Vite (with `@vitejs/plugin-react`) under a unified Bun workspace monorepo structure.
- Routing: TanStack Router (React) managing type-safe client-side routes, layout-level auth guards, and static export. No TanStack Start / SSR.
- Design System: ShadCN components (Radix primitives + Tailwind CSS v4) copied into `packages/ui` (`@lofipix/ui`). See `docs/SHADCN.md`.
- Data Fetching: TanStack Query (React) for data fetching and caching with automatic retry logic. Used for auth and API state. No direct `fetch()` calls in components; use typed API modules.
- Forms: TanStack Form (React) + Zod.
- Client State: React state and context for local UI state.
- Animation: CSS transitions and the animation utilities shipped with ShadCN.
- Authentication Hooks: Better Auth React client handles login states, redirection flows, and cookie sessions.
- Validation: Every API response consumed here has a Zod schema (shared from `packages/db/models/`). TypeScript strict; no `any` in domain models.
- Async UX: Every async operation has explicit loading, error, success, and offline states.
- Testing: Vitest + Playwright.
- Local Data Storage: None. Interacts with the API for all persistence.

## Mobile Stack (`/mobile`)

Local-first, offline-first native app for capturing photos. Replaces the former
SolidJS PWA; there is no web build.

- UI Framework & Build Tools: bare React Native CLI (no Expo runtime), TypeScript, Bun for workspace scripts and package management. Generated `android/` and `ios/` projects are committed.
- Routing: React Navigation native-stack with typed route params and auth-gated screen groups.
- Design System: React Native primitives with `StyleSheet` and a shared token module for colour, spacing, radii and typography. `packages/ui` is web-only and is not imported.
- Local Database: embedded SQLite via `@op-engineering/op-sqlite`, owned by the PowerSync React Native SDK.
- Sync Engine: self-hosted PowerSync replicates PostgreSQL tables through Sync Streams. The app connects with a short-lived JWT (`organization_id` claim), writes go through PowerSync's durable upload queue to `POST /api/sync/upload`, and the connector rebases stale edits onto newer server rows.
- Data Access: TanStack DB collections over the PowerSync SQLite database are the read/write layer; screens use live queries. Auth and non-synced API state use the Better Auth client and typed API modules. No direct `fetch()` calls in components.
- Forms: TanStack Form (React) + Zod.
- Client State: React state and context for local UI state.
- Device Storage: app documents directory for photo bytes; `react-native-keychain` for bearer tokens; AsyncStorage for the non-secret cached session profile.
- Soft Deletes: Tables use tombstones / soft-delete rows; PowerSync streams include them and the app filters `deleted_at is null` in reads.
- Validation: Every API response and database record has a Zod schema. TypeScript strict; no `any` in domain models.
- Async UX: Every async operation has explicit loading, error, success, and offline states.
- Authentication Hooks: Better Auth bearer tokens; the API accepts both cookie sessions (website) and bearer sessions (mobile).
- Testing: Jest + React Native Testing Library; Maestro flows for device E2E.
- Storyboard: `docs/MOBILE.md`.

## The Server/API Stack (`/api`)

The central coordinator and source of truth: manages master records, handles auth,
filters client sync windows, hosts the application gateway, and issues storage credentials.

- Core API Gateway: Hono running natively on the Bun runtime. This is the source of truth for all domain data.
- Data Persistence: PostgreSQL as the source of truth.
- Database Management: Drizzle ORM for application tables in `public` (schema-as-source-of-truth, synced with `drizzle-kit push`); Better Auth syncs its own tables into the `auth` schema (see `docs/AUTHENTICATION.md`).
- Soft Deletes: Tombstone / soft-delete rows on synced tables so PowerSync and mobile clients converge correctly.
- Validation: Every API response and database record has a Zod schema, shared from `packages/db/models/`.
- Authentication Backend: Better Auth (config in `packages/db/auth.ts`, tables in the `auth` schema). Cookie sessions serve the website; the bearer plugin serves the mobile app. See `docs/AUTHENTICATION.md` for methods and plugins.
- Authorization Engine: enforced via the Better Auth organisation plugin (organisation / member tables in the `auth` schema). Mobile sync tokens carry an `organization_id` claim minted from the user's single active organisation. See `docs/AUTHENTICATION.md` and `docs/POWERSYNC.md`.
- Data Replication: PowerSync replicates PostgreSQL through logical replication and Postgres-backed bucket storage; JWTs scope each sync stream to one organisation.
- Background Jobs: pgmq (Postgres-hosted queue) for async work such as image conversion.
- Reverse Proxy: Nginx as a high-performance proxy handling TLS termination (HTTPS) at the edge.
- Storage: SeaweedFS (S3-compatible object storage) with path buckets behind nginx. Private buckets. All uploads/downloads use API-generated pre-signed URLs.
- Observability: Instrumented for Uptrace (see `docs/UPTRACE.md`).

## The Shared Core Workspace (packages/db)

- Single Source of Truth: local Drizzle table definitions plus their Zod schemas in `packages/db/models/`, imported by API and clients — do not re-define them locally. Type-only Better Auth proxies live in `packages/db/external/` (no table definitions, so `push` never touches the `auth` schema).
- Validation Mapping: `drizzle-zod` translates table columns into Zod schema parsers shared across all apps. Every database record and API response has a schema.
- Strict Types: TypeScript strict; no `any` in domain models.
- Soft Deletes: Tombstone columns (e.g. `deleted_at` / `is_deleted`) on synced tables.

## Frontend conventions (www/ + mobile/)

- Declarative React components only on the website; React Native components on mobile. No SolidJS.
- No direct `fetch()` calls in components; use typed API modules.
- TanStack Query for server state (auth, uploads, non-synced API state) with automatic retry.
- TanStack Form + Zod for forms.
- Website: TanStack Router, ShadCN + Tailwind, React state for ephemeral UI state.
- Mobile: React Navigation, StyleSheet tokens, React state for ephemeral UI state; synced reads come from TanStack DB collections over PowerSync SQLite.
- Every async operation surfaces loading, error, success, and offline states.

# Communication channels

Website ↔ Server API Gateway

- Protocol: Standard HTTPS request/response.
- Auth State: Cookie-based user sessions managed by Better Auth.
- Data Access: Typed API modules validated with shared Zod schemas; TanStack Query handles caching and retry.
- Xero Connection: Clicking "Connect Xero" redirects to Xero's authorization screen. On callback success, Hono queries Xero's connection API, saves the valid multi-tenant profile mappings into the account's JSONB metadata column via Drizzle, and routes the user back to the SPA.

Mobile Read-Path Data Sync (Server → Mobile)

- Protocol: PowerSync Sync Streams at `https://<region>.lofipix.app/powersync/`. The service listens on loopback; nginx terminates TLS and supports WebSocket upgrade.
- Data Boundary Control: `POST /api/sync/token` authenticates the Better Auth session, requires exactly one active organisation and signs a 5-minute JWT with an `organization_id` claim. PowerSync verifies it against the API JWKS (`audience: powersync`). `albums` and `storage_providers` filter directly on `organization_id`; `photos` and `photo_locations` join through `albums`. `storage_providers.encrypted_data` is an encrypted-at-rest JSONB column that is synced to the mobile app and returned from client-facing endpoints; only the API server holds `STORAGE_PROVIDER_CREDENTIALS_KEY` and can decrypt it.
- Local Reactivity: PowerSync owns SQLite; TanStack DB collections provide live queries and optimistic writes, including offline states.
- Deletes: Tombstones are synced; reads filter `deleted_at is null`.

Mobile Write-Path Mutations (Mobile → Server)

- Protocol: PowerSync's durable upload queue posts CRUD batches to `POST /api/sync/upload` with the operation, table, row id, changed columns, `baseVersion` and the PowerSync client id.
- Path Flow: Hono validates shared Zod schemas, resolves tenancy through the parent album, applies version-checked writes and soft deletes, and returns per-entry results. There is no client-side mutation queue and no server receipts table; uploads are idempotent by natural key.
- Conflicts: a `409` returns the current row/version; the connector writes the server row locally, re-applies the pending changed columns with the new version and lets PowerSync enqueue a fresh upload. Rebase is silent; only a failed rebase surfaces a sync error.
- Binary Uploads: Images are written to the app documents directory locally, then uploaded to SeaweedFS via API-issued pre-signed URLs in a later task; conversion metadata (dimensions, page number, duration) is tracked as a custom Uptrace span.

Image / Object Storage

- Protocol: HTTPS to SeaweedFS via nginx reverse proxy, using pre-signed URLs generated by the Hono API.
- Clients never hold S3 credentials. The mobile documents directory holds the local copy; SeaweedFS holds the canonical object.
