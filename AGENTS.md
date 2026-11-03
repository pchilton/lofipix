# AGENTS.md — lofipix

Shared instructions for AI coding agents (Kilo Code, Hermes, and others) working in this repository. This file defines the durable rules.
Individual development tasks live in `prompts/` — an agent asked to "implement `prompts/NNNN`" reads this file first, then the prompt file.

## What this project is

lofipix is a multi-client app platform for panel-beaters to capture vehicle
damage photos offline and sync them to cloud storage. The README (`README.md`)
is the single source of truth for domain context (about, mobile app behaviour, photo
compression), architecture diagram, directory table, and stack — read it first,
consult it during tasks, do not duplicate it in prompts.

- **Web app** — React + TanStack Router (React), static export, no ElectricSQL, ShadCN + Tailwind, Bun (`www/`; SolidJS until prompt 0025)
- **Mobile** — bare React Native + React Navigation, offline-first via embedded SQLite (`@op-engineering/op-sqlite`) + ElectricSQL shapes + an outbox, and the app documents directory for photo bytes, Bun (`mobile/` from prompt 0026; `pwa/` is the legacy SolidJS PWA until then)
- **Central API** — Hono + Bun + Drizzle ORM, source of truth (`api/`)
- **Database** — PostgreSQL: Better Auth tables in the `auth` schema (synced by Better Auth, see `docs/AUTHENTICATION.md`); application tables in `public` (Drizzle schema + `drizzle-kit push`, `packages/db`)
- **Storage** — SeaweedFS (S3-compatible)
- **Shared models** — Zod schemas + TypeScript types (`packages/db/models/`); Better Auth proxies (`packages/db/external/`: type-only re-exports plus structural FK targets, never managed by Drizzle)
- **scripts** — `scripts/`
- **Edge Functions** — `workers/` (Cloudflare Workers)

Deployment: Github Actions.

## Documentation index (`docs/`)

Read the relevant file when a task touches its area:

- `docs/ARCHITECTURE.md` — target technology stacks for `www/`, `mobile/`, `api/`, shared models, frontend conventions, communication channels.
- `docs/WEBSITE.md` — website storyboard: pages, contents, user journey (marketing → dashboard → account/billing).
- `docs/MOBILE.md` — mobile storyboard: offline capture loop (dashboard → create → capture → finish → submit), SQLite cache and native modules.
- `docs/ELECTRICSQL.md` — ElectricSQL + SQLite sync: shape proxy, outbox/version contract, cache rebuild and updates.
- `docs/AUTHENTICATION.md` — Better Auth setup: config (`packages/db/auth.ts`), `auth`-schema tables per plugin, the two-step sync process, and `packages/db/external` proxies (types + foreign-key targets).
- `docs/STORAGE.md` — SeaweedFS setup, buckets, auth, systemd service.
- `docs/DEPLOYMENT.md` — deployment targets, domains, auth cookies.
- `docs/NGINX.md` — nginx reverse proxy for API and storage.
- `docs/UPTRACE.md` — self-hosted observability (Docker skeleton + instrumentation map).
- `docs/SHADCN.md` — ShadCN web components in `packages/ui`: install flow, theme, Storybook, Vitest, consumption from `www/`.
- `docs/ICONS.md` — Iconify icons: React components via unplugin-icons on the web and bundled data via react-native-svg in the mobile app.
- `docs/PHOTOS.md` — the `photos` table: columns, constraints, soft deletes, sync and the backing stores holding the image bytes.
- `docs/PHOTO_LOCATIONS.md` — storage providers and photo locations: how device-local (`opfs`), SeaweedFS, OneDrive and Google Drive copies are recorded, verified, synced and cleaned up; credential encryption.

## Non-negotiables

- **Verify before claiming done.** Run the project's typecheck/tests after changes and report the real output. Never report success from assumption.
- **Keep the working tree clean.** Run `git status` before starting; do not add files to commit; do not perform commits; never force-push or rewrite history.
- **Database changes use push, not migrations.** Application tables sync via `REGION=cholet bun run db:push` from `packages/db` (schema-as-source-of-truth, no SQL files in the repo). Auth tables are synced by Better Auth into the `auth` schema (see `docs/AUTHENTICATION.md`). Never define auth tables in the Drizzle schema — reference them only through the FK-target proxies in `packages/db/external/`.
- **Don't invent files or APIs.** If the README or a prompt references something that doesn't exist yet, create it as part of the task or flag the gap — don't silently substitute something else.
- **Match the stack exactly.** TypeScript everywhere (no plain JS sources), Zod for shared validation, Drizzle for DB access, Better Auth for authentication. No alternative ORMs, frameworks, or validation libraries unless the prompt explicitly calls for them.

## Conventions

- Packages are managed by Bun: use `bun install`; the lockfile is `bun.lock`.
- Region-specific environment lives in `.env.<REGION>` at the repo root; prefix Bun commands with the region (e.g. `REGION=cholet bun run <script>`), and `import "@lofipix/env";` loads it exactly once per process.
- Database sync is two-step: Better Auth tables sync into the `auth` schema via `REGION=cholet bun scripts/reset-database.ts` (driven by `packages/db/auth.ts`); application tables sync into `public` via `db:push` from `packages/db`. Custom SQL (extensions, functions, views) is applied manually or in a later task — no SQL migration files in the repo.
- Each app folder (`api/`, `www/`, `mobile/`) uses Bun for scripts and package management; `www/` and `api/` use HMR. API database access uses Drizzle with `DATABASE_URL`.
- Shared types and Zod schemas go in `models/` and are imported by API and clients — do not re-define them locally. Database models (Drizzle tables + their Zod schemas) live in `packages/db/models/`.
- Website code is React + TanStack Router/Query/Form with ShadCN; mobile code is React Native + React Navigation with SQLite/Drizzle. Do not introduce SolidJS, TarkUI, PGlite, VitePWA or TanStack DB.
- Record ids are UUIDv7 generated with `uuidv7()` from the `uuid` package, not `Bun.randomUUIDv7()`: the mobile app is native and must mint ids offline.
- API endpoints validate input with Zod schemas from `models/`.
- Shared web UI components (ShadCN: Radix + Tailwind) live in `packages/ui` (`@lofipix/ui`) as copied-in source, each with a colocated `*.stories.tsx`. Follow `docs/SHADCN.md`. Never run the ShadCN CLI or `solidcn` inside a workspace package directory: it can write an `npm` lockfile there. Generate outside the workspace and copy source in. Storybook and component tests run from `packages/ui` (`bun run storybook`, `bun run test`).
- The mobile local schema lives in `mobile/src/lib/db/schema.ts` (created in prompt 0026) and uses a versioned cache rebuild, not incremental migrations. Syncable local tables carry a client-only `outbox_needed` flag and an outbox; local writes go through the outbox, not directly to the API.
- Icons come from Iconify collections. Web apps compile them with unplugin-icons (`~icons/<prefix>/<name>`, static names); the mobile app bundles them for react-native-svg. Never fetch icons from the Iconify API at runtime. Follow `docs/ICONS.md`.
- Object storage access goes through pre-signed URLs generated by the API — clients never hold S3 credentials.
- Photo bytes are located through `storage_providers` and `photo_locations` (see `docs/PHOTO_LOCATIONS.md`). `storage_providers.encrypted_data` is a separate server-only object of individually encrypted secret fields: never include it in an Electric shape, return it from a client-facing endpoint, or log it.
- Authorization is enforced via the Better Auth organisation plugin (organisation / member tables in the `auth` schema). See `docs/AUTHENTICATION.md`.
- Config comes from `.env.<REGION>` environment variables; no secrets committed to the repo.
- New top-level directories should be reflected in the README's directory table in the same change.

## Working with prompts/

- Tasks are numbered markdown files: `0001-<slug>.md`, `0002-<slug>.md`, …
- Each prompt contains: Context, Scope, Constraints, Definition of Done.
- Execute the Definition of Done checkboxes as literal acceptance criteria.
- If a prompt contradicts this file, the prompt wins for that task only — note the deviation in your report.
- When you complete a prompt, mark it completed (see `prompts/README.md`).
- Already completed prompts will have a suffix of `.done.md`, such as: `0001-<slug>.done.md`, `0002-<slug>.done.md`, …

## Reporting

When finished a task, report: what changed (files created/modified), what was verified (commands run + real results), and what is left or blocked. Do not re-narrate the process.
