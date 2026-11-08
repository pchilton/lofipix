# Authentication

Better Auth is the authentication system. All auth tables live in a dedicated
PostgreSQL `auth` schema, isolated from application tables in `public`.

## Config

`packages/db/auth.ts` is the single Better Auth config, imported by both the
API and `scripts/reset-database.ts` so both use the same plugin list.

- Methods: email+password; cookie sessions for the website; bearer tokens for
  the native mobile app.
- Database: Kysely `PostgresDialect` over `DATABASE_URL`, with
  `schemaName: 'auth'` so every Better Auth table is created in the `auth`
  schema. Plugins are configured in the same file (organisation, bearer,
  magic link, email OTP, generic OAuth and JWT).

## API mounting and CORS

`api/src/index.ts` mounts `auth.handler` at `/api/auth/*` for GET and POST and
applies CORS with credential support. Allowed origins are listed both in the
Hono CORS allowlist and in Better Auth's `trustedOrigins`
(`packages/db/auth.ts`): `192.168.1.15` on port 5173 for development (localhost
is intentionally unsupported), `https://www.lofipix.app`, and the native app
scheme `lofipix://`. The native app has no browser origin; its API calls send an
`Authorization: Bearer` header instead of relying on CORS. Add any new browser
origin in both places.

Session cookies are host-only in development, scoped to `192.168.1.15`, so the
website and API share the session. In production
(`advanced.crossSubDomainCookies`) they are issued for `.lofipix.app`, making
the session available across all `*.lofipix.app` subdomains. Bearer sessions do
not use cookies.

The retired PWA origins have been removed; only the website, preview and native
scheme are trusted.

## Plugins and tables

| Plugin | Tables in `auth` | Purpose |
| --- | --- | --- |
| core | `user`, `session`, `account`, `verification` | Identities, sessions, OAuth accounts, verification tokens. |
| `organization` | `organization`, `member`, `invitation` (+ `activeOrganizationId` on `session`) | Organisations, memberships with roles, pending invitations. Replaces the old local `organisations`/`roles` tables. |
| `bearer` | — (uses `session`) | Converts an `Authorization: Bearer <token>` header into a session for the native mobile app. No new tables. |
| `magicLink` | — (uses `verification`) | Passwordless sign-in via emailed link. |
| `emailOTP` | — (uses `verification`) | One-time codes for email verification / login. |
| `genericOAuth` | — (uses `account`) | OAuth2 integrations (e.g. Xero: `offline_access`, token refresh). |
| `jwt` | `jwks` | Signs short-lived PowerSync tokens (EdDSA/Ed25519) and publishes the JWKS at `/api/auth/jwks`. |

## Native bearer transport

The mobile app signs in with the normal Better Auth email/password endpoints and
receives a session token. It stores that token in `react-native-keychain` and
sends it on every API, token and upload request:

```http
Authorization: Bearer <token>
```

The `bearer()` plugin converts the header into the same Better Auth session
that a cookie would produce. `api/src/index.ts` resolves sessions through
`auth.api.getSession({ headers })`, so `POST /api/sync/token` and
`POST /api/sync/upload` accept either transport without separate code paths.
Token and upload responses set `Cache-Control: no-store`.

## PowerSync JWT

The `jwt()` plugin signs EdDSA/Ed25519 tokens with `audience: lofipix` and a
5-minute expiry. `POST /api/sync/token` resolves the session, requires exactly
one active organisation, and calls `auth.api.signJWT` with:

```json
{ "sub": "<user id>", "organization_id": "<active organisation id>" }
```

PowerSync verifies the token against `http://127.0.0.1:5634/api/auth/jwks`
with audience `lofipix`. A user with no active organisation, or with more
than one, gets `403`; the endpoint never mints an unscoped token. The `jwks`
table is part of the `auth` schema and is expected by the reset script.

A `401` means the token is missing or invalid; the app marks the session stale
and prompts for re-login without discarding local work. Signing out revokes the
session and clears the keychain token.

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

It verifies afterwards: all auth tables present in `auth` (including `jwks`),
`albums` present in `public`, no auth tables in `public`, and the `powersync`
bucket-storage schema available without being dropped.

## Proxies (`packages/db/external/`)

Two kinds of proxies let the app reference auth structures without owning the
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
