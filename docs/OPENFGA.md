# OpenFGA

OpenFGA provides relationship-based access control (ReBAC) for the API. Every
authorization decision is a relationship check such as "is `user:123` a
`member` of `organisation:456`?". OpenFGA stores those relationships as tuples
and evaluates them against an authorization model.

- **Server**: OpenFGA daemon running on the VPS under systemd.
- **Datastore**: PostgreSQL (the same database as the API).
- **API client**: `@openfga/sdk` in `api/src/authorization.ts`.
- **Tenant isolation**: every tuple is scoped to an `organisation:<id>` object.
  A user can only reach resources of organisations they have a relationship
  with.

## Authorization model

The model is versioned in OpenFGA. Write this model with the `fga` CLI or the
OpenFGA API and put the returned model id in `OPENFGA_AUTHORIZATION_MODEL_ID`.

```dsl
model
  schema 1.1

type user

type organisation
  relations
    define member: [user]
    define admin: [user]
    define can_view: member
    define can_manage: admin
```

- `member` is granted directly to a `user`.
- `admin` is granted directly to a `user`.
- `can_view` and `can_manage` are computed relations; checks against them
  resolve the underlying membership without storing extra tuples.

Resources added later belong to an organisation, for example:

```dsl
type photo
  relations
    define organisation: [organisation]
    define can_view: can_view from organisation
    define can_manage: can_manage from organisation
```

## Relationship tuples

A user joins an organisation through a tuple:

```
user:0199...  member  organisation:0198...
```

Tuple object names use the OpenFGA `<type>:<id>` syntax. The ids are the
`user.id` and `organisations.id` values from PostgreSQL.

Seed a membership with:

```sh
REGION=cholet bun scripts/seed-membership.ts \
  --user "Paul Chilton" \
  --organisation "LoFi Pix" \
  --relation member
```

The script looks up the user and organisation by name in PostgreSQL (erroring if
either is missing) and writes the tuple using their ids. `scripts/seed-user.ts`
and `scripts/seed-organisation.ts` create those records.

## API usage

Configuration comes from `.env.<REGION>` (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `OPENFGA_API_URL` | OpenFGA HTTP API, e.g. `http://127.0.0.1:8080` |
| `OPENFGA_STORE_ID` | Store (tenant) that holds this region's tuples |
| `OPENFGA_AUTHORIZATION_MODEL_ID` | Pinned authorization model version |
| `OPENFGA_API_TOKEN` | Pre-shared key when the daemon enables authentication |

`api/src/authorization.ts` exposes:

- `openfga` — configured `OpenFgaClient`.
- `isAuthorized(user, relation, object)` — one-off check.
- `writeRelationship({ user, relation, object })` — idempotent tuple write.
- `requirePermission({ relation, object, getUserId? })` — Hono middleware.
- `requireOrganisationRelation(relation)` — middleware for
  `organisation:<organisationId>` route params.

The middleware reads the authenticated user id from the Hono context
(`c.get('user').id` or `c.get('userId')`). Authentication is out of scope for
this task; the authentication middleware is expected to set that value. A
custom resolver can be passed with `getUserId`. Missing identity returns `401`,
a denied check returns `403`.

```ts
import { requireOrganisationRelation } from './authorization';

app.get(
  '/api/organisations/:organisationId',
  requireOrganisationRelation('can_view'),
  (c) => c.json({ organisationId: c.req.param('organisationId') }),
);
```

`GET /authz/status` reports OpenFGA connectivity for health checks.

## Datastore tables

OpenFGA tables should be migrated via the openfga migrate command: `openfga migrate`.

## Installation

OpenFGA ships as a standalone binary.

```sh
# Download the openfga_linux_amd64 binary from
# https://github.com/openfga/openfga/releases and install it:
install -m 0755 /path/to/openfga /usr/local/bin/openfga
useradd --system --no-create-home --shell /usr/sbin/nologin openfga
install -d -o openfga -g openfga /etc/openfga
```

Create `/etc/openfga/openfga.env`:

```sh
OPENFGA_DATASTORE_URI=postgres://user:password@127.0.0.1:5432/lofipix?sslmode=disable
OPENFGA_PRESHARED_KEY=<openssl rand -base64 100 | tr -dc 'a-zA-Z0-9' | head -c 64 ; echo>
```

The same pre-shared key is set as `OPENFGA_API_TOKEN` for the API.

### Systemd service

`/etc/systemd/system/openfga.service`:

```conf
[Unit]
Description=OpenFGA authorization server
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=openfga
Group=openfga
EnvironmentFile=/etc/openfga/openfga.env
ExecStart=/usr/local/bin/openfga run \
    --datastore-engine postgres \
    --datastore-uri "${OPENFGA_DATASTORE_URI}" \
    --http-addr localhost:8080 \
    --grpc-addr localhost:8081 \
    --authn-method preshared \
    --authn-preshared-keys "${OPENFGA_PRESHARED_KEY}"
Restart=on-failure
RestartSec=5s

ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Enable it:

```sh
systemctl daemon-reload
systemctl enable openfga
systemctl start openfga
systemctl status openfga
```

Enable the schema:
```sh
/usr/local/bin/openfga migrate \
  --verbose \
  --datastore-engine postgres \
  --datastore-uri "${OPENFGA_DATASTORE_URI}"
```

Check the health of the service:

```sh
curl -X GET http://localhost:8080/healthz
```

## Command Line

Download the debian package for the FGA command line, from https://github.com/openfga/cli/releases


## Initial store setup

Create one store per region, then write the authorization model:

Create the store, and capture the store ID:
```sh
fga store create --name "lofipix-<region>" --api-token "<api_token>"
fga store list --api-token "<api_token>"
```

Create the authorisation model. Capture the model ID:

```sh
fga model write \
  --store-id "<store-id>" \
  --api-token "<api_token>" \
  --file scripts/authorisation.fga
```
Copy the store id and model id into `.env.<REGION>` as

```
OPENFGA_STORE_ID=<generated_during_setup>
OPENFGA_AUTHORIZATION_MODEL_ID=<generated_during_setup>
```

## Verifying

```sh
curl http://localhost:8080/healthz
curl http://localhost:5634/authz/status
```
