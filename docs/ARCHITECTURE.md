# Technology stacks

Target stack for `www/`, `mobile/`, and `api/`. The website is React; the mobile
app is bare React Native. The central API in `api/` backed by PostgreSQL is the
source of truth; the mobile client is local-first and offline-capable.

## Website (`/www`)

Public website: product description, organisation signup, billing, account management.
A plain static site: no service worker, no ElectricSQL sync, no local persistence.

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
- Local Database: embedded SQLite via `@op-engineering/op-sqlite`, accessed with Drizzle ORM.
- Sync Engine: ElectricSQL streams PostgreSQL table shapes through an authenticated API proxy. A custom writer applies shape messages to SQLite. A SQLite-backed outbox sends local mutations to `POST /api/sync/mutations` with version checks and server-side idempotency.
- Non-synced State: TanStack Query (React) for local SQLite query caching and non-synced API state, with automatic retry logic. Auth uses the Better Auth client. No direct `fetch()` calls in components; use typed API modules.
- Forms: TanStack Form (React) + Zod.
- Client State: React state and context for local UI state.
- Device Storage: app documents directory for photo bytes; `react-native-keychain` for bearer tokens; AsyncStorage for the non-secret cached session profile.
- Soft Deletes: Tables use tombstones / soft-delete rows so deletes propagate through sync instead of disappearing.
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
- Soft Deletes: Tombstone / soft-delete rows on synced tables so Electric shapes and mobile clients converge correctly.
- Validation: Every API response and database record has a Zod schema, shared from `packages/db/models/`.
- Authentication Backend: Better Auth (config in `packages/db/auth.ts`, tables in the `auth` schema). Cookie sessions serve the website; the bearer plugin serves the mobile app. See `docs/AUTHENTICATION.md` for methods and plugins.
- Authorization Engine: enforced via the Better Auth organisation plugin (organisation / member tables in the `auth` schema). See `docs/AUTHENTICATION.md`.
- Data Replication: ElectricSQL sitting alongside PostgreSQL, tracking WAL changes and serving table shapes to the API proxy for mobile clients.
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
- Mobile: React Navigation, StyleSheet tokens, React state for ephemeral UI state; synced reads come from SQLite.
- Every async operation surfaces loading, error, success, and offline states.

# Communication channels

Website ↔ Server API Gateway

- Protocol: Standard HTTPS request/response.
- Auth State: Cookie-based user sessions managed by Better Auth.
- Data Access: Typed API modules validated with shared Zod schemas; TanStack Query handles caching and retry.
- Xero Connection: Clicking "Connect Xero" redirects to Xero's authorization screen. On callback success, Hono queries Xero's connection API, saves the valid multi-tenant profile mappings into the account's JSONB metadata column via Drizzle, and routes the user back to the SPA.

Mobile Read-Path Data Sync (Server → Mobile)

- Protocol: ElectricSQL shape streams (`/v1/shape`) proxied by Hono at `GET/POST /api/sync/shapes/:table`. The API injects the organisation filter, column projection and Electric secret; clients never hold an Electric URL or secret.
- Data Boundary Control: Clients authenticate with a Better Auth bearer token (or cookie session); Hono resolves the active organisation and streams only rows matching `organization_id`. Deletes arrive as tombstone rows and are filtered by `deleted_at is null` in reads.
- Local Reactivity: A custom writer applies Electric messages to SQLite; screens re-query through a small change notifier, including offline states.

Mobile Write-Path Mutations (Mobile → Server)

- Protocol: A SQLite outbox posts batched mutations to `POST /api/sync/mutations` with a client mutation id, `base_version` and payload. Retries use exponential backoff; the server records mutation ids in `sync_mutations` for idempotency.
- Path Flow: Mutations resolve in Hono against PostgreSQL with per-row version checks, then fan back out through Electric shapes. Conflicts replace the local row with the server row; rejected mutations become `dead`.
- Binary Uploads: Images are written to the app documents directory locally, then uploaded to SeaweedFS via API-issued pre-signed URLs in a later task; conversion metadata (dimensions, page number, duration) is tracked as a custom Uptrace span.

Image / Object Storage

- Protocol: HTTPS to SeaweedFS via nginx reverse proxy, using pre-signed URLs generated by the Hono API.
- Clients never hold S3 credentials. The mobile documents directory holds the local copy; SeaweedFS holds the canonical object.
