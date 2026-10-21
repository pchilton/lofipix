# AGENTS.md — lofipix

Shared instructions for AI coding agents (Kilo Code, Hermes, and others) working in this repository. This file defines the durable rules.
Individual development tasks live in `prompts/` — an agent asked to "implement `prompts/NNNN`" reads this file first, then the prompt file.

## What this project is

lofipix is a multi-client app platform for panel-beaters to capture vehicle
damage photos offline and sync them to cloud storage. The README (`README.md`)
is the single source of truth for domain context (about, PWA behaviour, photo
compression), architecture diagram, directory table, and stack — read it first,
consult it during tasks, do not duplicate it in prompts.

- **Web app** — SolidJS + TanStack Router (Solid), static export, no PWA/PowerSync, Bun (`www/`)
- **PWA** — SolidJS + TanStack Router (Solid) + VitePWA, offline-first via PowerSync + OPFS, Bun (`pwa/`)
- **Central API** — Hono + Bun + Drizzle ORM, source of truth (`api/`)
- **Database** — PostgreSQL: Better Auth tables in the `auth` schema (synced by Better Auth, see `docs/AUTHENTICATION.md`); application tables in `public` (Drizzle schema + `drizzle-kit push`, `packages/db`)
- **Storage** — SeaweedFS (S3-compatible)
- **Shared models** — Zod schemas + TypeScript types (`packages/db/models/`); type-only Better Auth proxies (`packages/db/external/`, no table definitions)
- **scripts** — `scripts/`
- **Edge Functions** — `workers/` (Cloudflare Workers)

Deployment: Github Actions.

## Documentation index (`docs/`)

Read the relevant file when a task touches its area:

- `docs/ARCHITECTURE.md` — target technology stacks for `www/`, `pwa/`, `api/`, shared models, frontend conventions, communication channels.
- `docs/WEBSITE.md` — website storyboard: pages, contents, user journey (marketing → dashboard → account/billing).
- `docs/WEBAPP.md` — PWA storyboard: offline capture loop (dashboard → create → capture → finish → submit).
- `docs/AUTHENTICATION.md` — Better Auth setup: config (`packages/db/auth.ts`), `auth`-schema tables per plugin, the two-step sync process, and `packages/db/external` type proxies.
- `docs/STORAGE.md` — SeaweedFS setup, buckets, auth, systemd service.
- `docs/DEPLOYMENT.md` — deployment targets, domains, auth cookies.
- `docs/NGINX.md` — nginx reverse proxy for API and storage.
- `docs/UPTRACE.md` — self-hosted observability (Docker skeleton + instrumentation map).
- `docs/TARKUI.md` — TarkUI shared components in `packages/ui`: solidcn install flow, Storybook, Vitest, consumption from `www/` and `pwa/`.

## Non-negotiables

- **Verify before claiming done.** Run the project's typecheck/tests after changes and report the real output. Never report success from assumption.
- **Keep the working tree clean.** Run `git status` before starting; do not add files to commit; do not perform commits; never force-push or rewrite history.
- **Database changes use push, not migrations.** Application tables sync via `REGION=cholet bun run db:push` from `packages/db` (schema-as-source-of-truth, no SQL files in the repo). Auth tables are synced by Better Auth into the `auth` schema (see `docs/AUTHENTICATION.md`). Never define auth tables in the Drizzle schema.
- **Don't invent files or APIs.** If the README or a prompt references something that doesn't exist yet, create it as part of the task or flag the gap — don't silently substitute something else.
- **Match the stack exactly.** TypeScript everywhere (no plain JS sources), Zod for shared validation, Drizzle for DB access, Better Auth for authentication. No alternative ORMs, frameworks, or validation libraries unless the prompt explicitly calls for them.

## Conventions

- Packages are managed by Bun: use `bun install`; the lockfile is `bun.lock`.
- Region-specific environment lives in `.env.<REGION>` at the repo root; prefix Bun commands with the region (e.g. `REGION=cholet bun run <script>`), and `import "@lofipix/env";` loads it exactly once per process.
- Database sync is two-step: Better Auth tables sync into the `auth` schema via `REGION=cholet bun scripts/reset-database.ts` (driven by `packages/db/auth.ts`); application tables sync into `public` via `db:push` from `packages/db`. Custom SQL (extensions, functions, views) is applied manually or in a later task — no SQL migration files in the repo.
- Each app folder (`api/`, `www/`, `pwa/`) uses Bun with HMR. API database access uses Drizzle with `DATABASE_URL`.
- Shared types and Zod schemas go in `models/` and are imported by API and clients — do not re-define them locally. Database models (Drizzle tables + their Zod schemas) live in `packages/db/models/`.
- API endpoints validate input with Zod schemas from `models/`.
- Shared UI components (TarkUI: Ark UI + Tailwind) live in `packages/ui` (`@lofipix/ui`) as copied-in source, each with a colocated `*.stories.tsx`. Follow `docs/TARKUI.md`. Never run `solidcn add` or `solidcn update` inside a workspace package directory: it runs `npm` there. Storybook and component tests run from `packages/ui` (`bun run storybook`, `bun run test`).
- Object storage access goes through pre-signed URLs generated by the API — clients never hold S3 credentials.
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
