# Technology stacks

## Website (/www)

Public website, describing the tools. Organisation signup. Billing. Account management.

- UI Framework & Build Tools: SolidJS built with Vite under a unified Bun Workspace monorepo structure.
- Design System: Tark UI (powered by Ark UI framework-agnostic state machines and styled using Tailwind CSS utilities).
- Client Routing: TanStack Router managing type-safe client-side single page application (SPA) pathways and layout-level auth guards.
- Authentication Hooks: Better Auth Client handles user login states, redirection flows, and cookie sessions.
- Local Data Storage: None. Interact with the API for

## PWA Web Stack (/pwa)

Local-first application for capturing photos.

- UI Framework & Build Tools: SolidJS built with Vite under a unified Bun Workspace monorepo structure.
- Design System: Tark UI (powered by Ark UI framework-agnostic state machines and styled using Tailwind CSS utilities).
- Client Routing: TanStack Router managing type-safe client-side single page application (SPA) pathways and layout-level auth guards.
- Local Data Store: PGlite running an in-memory/IndexedDB WebAssembly Postgres engine directly inside the browser sandbox.
- Reactivity Interface: TanStack DB wrapping PGlite to provide live, synchronized component tracking signals.
- Authentication Hooks: Better Auth Client handles user login states, redirection flows, and cookie sessions.


## The Server/API Stack (/api)

The central coordinator that manages master records, handles OAuth exchanges, filters client sync windows, and hosts the application gateway.

- Core API Gateway: Hono running natively on the Bun Runtime for high-performance HTTP and streaming capabilities.
- Database Management: Drizzle ORM handling TypeScript type generation and automated multi-schema migrations.
- Data Persistence: PostgreSQL.
- Authentication Backend: Better Auth Server configured with the core auth tables (user, account, session, verification). Extended via plugins:
  - @better-auth/api-key: Automatically manages token generation tables for headless/hardware client verification loops.
  - genericOAuth: Manages the integration with Xero OAuth2, including token acquisition parameters (offline_access) and token lifecycle refresh logic.
- Authorization Engine: OpenFGA checking relationship tuples (inspired by Google's Zanzibar paper) to authorize user resource access.
- Data Replication: Electric SQL Sync Service sitting alongside PostgreSQL to track logical replication logs and manage streaming data slices.
- Reverse Proxy: Nginx acting as a standard high-performance proxy handling secure TLS Termination (HTTPS) at the edge.
- Storage: SeaweedFS is configured with path buckets, proxied by nginx. Private bucket. All requests are signed for uploads and downloads.

## The Shared Core Workspace (packages/db-schema)

- Single Source of Truth: A single location for Drizzle table definitions.
- Validation Mapping: Leverages drizzle-zod to automatically translate table columns into Zod schema parsers, providing validation rules shared across all apps.
- Schema Extension: The account table features a custom JSONB column to securely hold Xero metadata structures, such as accessible connection lists (tenants) and the active profile identifier (activeTenantId).

## The Desktop Client Stack (apps/desktop-electron)

The physical hardware worker wrapper providing automated script compilation and task execution in a responsive container shell.
- App Shell: ElectronJS orchestrating window states and operating system integration hooks.
- Main Process Hub: Runs PGlite locally to disk for offline data persistence, coupled with a background Electric SQL Client instance to handle data fetching.
- Embedded Dependencies (extraResources): Platform-specific pre-compiled binaries for the Bun execution runtime and a Portable Python sandbox environment bundled directly inside the production distribution.


## The Virtual Device Stack (apps/virtual-device)

The headless cloud worker variant running inside a Docker container on a VPS, mimicking hardware architecture on an automated scale.
- Runtime Core: The Headless Worker Core npm package (packages/worker-core) shared with Electron. It boots a raw Bun daemon script completely devoid of Electron/Chromium viewport dependencies.
- Container Blueprint: Multi-stage Dockerfile running on a lightweight Linux footprint. It pre-installs identical targeted platform footprints of Bun and Portable Python to match Electron's runtime layout exactly.
- Data Volume Persistence: Docker volume mappings allocated to store the local PGlite database file, preserving state history across container recreation cycles.




# Communication channels

Web App ↔ Server API Gateway

- Protocol: Standard HTTPS request/response lanes.
- Auth State: Cookie-based user sessions managed automatically by Better Auth.
- Xero Connection: Clicking "Connect Xero" prompts a redirection path to Xero's authorization screen. On callback success, Hono queries Xero's connection API, saves the valid multi-tenant profile mappings directly into the account's JSONB metadata column via Drizzle, and routes the user back to the web SPA.


Hardware & Virtual Devices ↔ Server Gateway

- Protocol: Pure HTTPS communication. All requests route directly through Nginx's secure port.
- Auth State: Bypasses cookie structures completely. Devices authenticate by passing a persistent client token inside the HTTP headers (Authorization: Bearer tk_desktop_...). Hono's middleware resolves this token using Better Auth's API Key hashing engine.
- Device Onboarding:
    - Physical Apps: Users click "Generate Token" inside the Web SPA dashboard, copy the token string, and paste it into Electron's input layout (which stores it in the OS Keychain).
    - Virtual Apps: The central Hono API orchestrates virtual worker creation programmatically. It hits Better Auth's plugin engine to generate a token, provisions a virtual machine identifier, and injects them as standard OS environment variables during the container's docker run lifecycle.


Read-Path Data Sync (Server → All Clients)

- Protocol: High-efficiency, continuous chunked HTTP streaming managed by Electric SQL.
- Data Boundary Control: Clients hit a protected sync route on Hono providing their API Key. Hono runs an OpenFGA permission check and proxies back a highly specific Electric Shape filtered by SQL queries (e.g., where assigned_worker_id = 'resolved_user_id' AND status = 'queued'). This pushes JSON data deltas straight into the local PGlite instances of both browser tabs and background processes.


Write-Path Mutations (All Clients → Server)

- Protocol: Unidirectional HTTP POST requests.
- Path Flow: Clients never push changes through the replication sync engine. Status mutations (e.g., marking a task complete or altering an active Xero tenant ID) bypass Electric and target dedicated Hono API routes directly, updating the master PostgreSQL cluster.



Electron/Daemon Main Process ↔ Spawned Task Workers

- Protocol: Local operating system Inter-Process Communication (IPC / child_process).
- Execution Trigger: The background core inspects the incoming task profile payload. It reads the target runtime property (python or bun) and spawns an isolated container thread, feeding run parameters and dependencies down via command-line arguments (argv).
- Logging Pipelines: Child processes handle calculations headlessly, piping standard terminal streams (stdout/stderr) back up to the parent application process to log task velocity and progress metrics.

Local Offline Reconciliation (Transactional Outbox)

- When a background script finishes execution, the main app process wraps data operations into a single atomic transaction block inside PGlite.
- It updates the local tasks status to completed while inserting a pending transmission request record into a local sync_outbox table.
- A background supervisor loop watches the outbox table sequentially. It attempts delivery upstream to Hono over HTTPS and deletes the item from the outbox queue only after receiving a verified 200 OK network confirmation, safeguarding tasks against device network loss or sudden power shutdowns.
