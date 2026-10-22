# Authentication

Better Auth is the authentication system. All auth tables live in a dedicated
PostgreSQL `auth` schema, isolated from application tables in `public`.

## Config

`packages/db/auth.ts` is the single Better Auth config, imported by both the
API and `scripts/reset-database.ts` so both use the same plugin list.

- Methods: email+password.
- Database: Kysely `PostgresDialect` over `DATABASE_URL`, with
  `schemaName: 'auth'` so every Better Auth table is created in the `auth`
  schema. Detailed plugin configuration (OAuth providers, JWT options) is
  deferred to the new-authentication task; this setup only ensures the tables
  exist.

## Plugins and tables

| Plugin | Tables in `auth` | Purpose |
| --- | --- | --- |
| core | `user`, `session`, `account`, `verification` | Identities, sessions, OAuth accounts, verification tokens. |
| `organization` | `organization`, `member`, `invitation` (+ `activeOrganizationId` on `session`) | Organisations, memberships with roles, pending invitations. Replaces the old local `organisations`/`roles` tables. |
| `magicLink` | — (uses `verification`) | Passwordless sign-in via emailed link. |
| `emailOTP` | — (uses `verification`) | One-time codes for email verification / login. |
| `genericOAuth` | — (uses `account`) | OAuth2 integrations (e.g. Xero: `offline_access`, token refresh). |
| `jwt` | `jwks` | Key store for issuing/verifying JWTs. |

## Sync process (two steps, strict split)

1. **`auth` schema** — `getMigrations()` + `runMigrations()` from
   `better-auth/db/migration`, driven by `packages/db/auth.ts`. Never by
   Drizzle. No auth tables are defined in the Drizzle schema.
2. **`public` schema** — `drizzle-kit push` against `packages/db/schema.ts`
   (local `models/` only). No SQL migration files are stored in the repo.

`scripts/reset-database.ts` runs both steps after recreating the schemas:

```sh
REGION=cholet bun scripts/reset-database.ts
```

It verifies afterwards: all auth tables present in `auth`, `albums` present
in `public`, no auth tables in `public`.

## Proxies (`packages/db/external/`)

Two kinds of proxies let the app reference auth shapes without owning the
tables:

1. **Type proxies** (`external/auth.ts`) — type-only re-exports (`User`,
   `Organization`, `Member`, `Invitation`) from `better-auth` packages.
2. **Foreign-key targets** (`external/auth-tables.ts`) — minimal
   `pgSchema('auth').table(...)` definitions used only as the target of a
   foreign key, e.g. `authOrganization` for `auth.organization`.

Neither is re-exported from `packages/db/schema.ts`, so `drizzle-kit push`
never manages them: the `auth` schema is owned by Better Auth and is only read
as a foreign-key target. A `public` table therefore points at an auth table
without duplicating its definition:

```ts
organizationId: text('organization_id')
  .notNull()
  .references(() => authOrganization.id, { onDelete: 'cascade' }),
```

`drizzle-kit push` emits `REFERENCES "auth"."organization"("id")`; the auth
table must exist first, which the two-step sync guarantees.

When plugins change: update the plugin list in `packages/db/auth.ts`, extend
the proxies in `packages/db/external/`, and re-run
`scripts/reset-database.ts` (or the auth step alone via `getMigrations`).
