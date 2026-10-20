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

## Type proxies (`packages/db/external/`)

Type-only re-exports (`User`, `Organization`, `Member`, `Invitation`) from
`better-auth` packages so the app can reference auth shapes without owning
the tables. They contain no `pgTable` definitions — otherwise
`drizzle-kit push` would create auth tables in `public`.

When plugins change: update the plugin list in `packages/db/auth.ts`, extend
the proxies in `packages/db/external/`, and re-run
`scripts/reset-database.ts` (or the auth step alone via `getMigrations`).
