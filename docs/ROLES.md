# Roles

Authorization is enforced with a `roles` table checked directly in PostgreSQL.
Every check is scoped to an organisation: a row links one user to one
organisation with one role. A user can have multiple rows (multiple roles,
across multiple organisations).

## Roles

| Role | Description |
| --- | --- |
| `owner` | Full control of the organisation, including role grants and deletion. |
| `admin` | Manages the organisation, members, and resources. Cannot remove owners. |
| `member` | Standard member with access to organisation resources. |
| `finances` | Access to billing and financial resources. Composable with other roles (e.g. a user can be both `member` and `finances`). |

Roles are stored as a PostgreSQL `ENUM` (`role`: `owner`, `admin`, `member`,
`finances`) on `roles.role`. A user can hold several roles in the same
organisation via multiple rows.

## Table

`roles` (`packages/db/models/roles.ts`):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | UUIDv7 (`Bun.randomUUIDv7()`), like `user`/`organisations`. |
| `organisation_id` | `uuid` FK → `organisations.id` | `ON DELETE CASCADE`. |
| `user_id` | `uuid` FK → `user.id` | `ON DELETE CASCADE`. |
| `role` | `role` enum | One of `owner`, `admin`, `member`, `finances`. |

Unique constraint on (`organisation_id`, `user_id`, `role`) prevents duplicate
grants while allowing multiple roles per user.

## API usage

`api/src/authorization.ts` exposes:

- `getUserRoles(userId, organisationId)` — list a user's roles in an organisation.
- `hasRole(userId, organisationId, ...allowed)` — true if the user holds any of the allowed roles.
- `requireOrganisationRole(...allowed, options?)` — Hono middleware enforcing one of the allowed roles on the `:organisationId` route param (customise with `{ param }`).
- `requireRole` — alias of `requireOrganisationRole`.

The middleware reads the authenticated user id from the Hono context
(`c.get('user').id` or `c.get('userId')`). Authentication is out of scope;
the authentication middleware is expected to set that value. A custom resolver
can be passed with `getUserId`. Missing identity returns `401`, a denied check
returns `403`.

```ts
import { requireOrganisationRole } from './authorization';

app.get(
  '/api/organisations/:organisationId',
  requireOrganisationRole('owner', 'admin', 'member'),
  (c) => c.json({ organisationId: c.req.param('organisationId') }),
);
```

Finance-only route:

```ts
app.get(
  '/api/organisations/:organisationId/billing',
  requireOrganisationRole('owner', 'finances'),
  (c) => c.json({ organisationId: c.req.param('organisationId') }),
);
```

## Seeding

```sh
REGION=cholet bun scripts/seed-roles.ts \
  --user "Paul Chilton" \
  --organisation "LoFi Pix" \
  --role member
```

The script looks up the user and organisation by name in PostgreSQL (erroring if
either is missing), validates `--role` against the enum, and inserts a row in
`roles`. `scripts/seed-user.ts` and `scripts/seed-organisation.ts` create those
records.
