# PowerSync

PowerSync is the sync engine for the mobile app. PostgreSQL remains the source
of truth. A self-hosted PowerSync Service, run from the upstream official Docker
image, replicates the four application tables to PowerSync SQLite on the
device. The app reads and writes through TanStack DB collections over that
database.

```text
PostgreSQL ──logical replication──► PowerSync Service (loopback :5677)
                                        │  Sync Streams + JWKS
                                        ▼
Mobile ──JWT──► https://<region>.lofipix.app/powersync/
Mobile ──Bearer──► API /api/sync/token   (mints the PowerSync JWT)
Mobile ──Bearer──► API /api/sync/upload  (PowerSync upload queue)
```

The website does not use PowerSync or local persistence.

## Data model and tenancy

- `albums` and `storage_providers` carry `organization_id` and filter on it
  directly.
- `photos` and `photo_locations` have no `organization_id`; the streams join
  through `albums`.
- Tombstones (`deleted_at`) are synced. The app filters `deleted_at is null` in
  reads, so deletes converge without losing audit history.

## Sync Streams

`powersync/sync-config.yaml` uses Sync Streams edition 3 with
`auto_subscribe: true` for every stream. The `organization_id` value comes from
`auth.parameter('organization_id')`, which PowerSync reads from the JWT.

## Authentication

1. The mobile app stores a Better Auth bearer token.
2. `POST /api/sync/token` resolves the session, requires exactly one active
   organisation and calls the Better Auth JWT signer.
3. The token has `sub`, `aud: lofipix`, `iat`/`exp` (5 minutes) and
   `organization_id`.
4. PowerSync verifies the token against the Better Auth JWKS at
   `http://127.0.0.1:5634/api/auth/jwks` with `client_auth.audience:
   [lofipix]`.

A user with no active organisation, or with more than one, receives `403`; no
unscoped token is ever issued. The mobile connector calls the token endpoint
again whenever PowerSync refreshes credentials.

The `jwks` table is created in the `auth` schema by the Better Auth JWT plugin.
`scripts/reset-database.ts` expects it.

## Upload and rebase

PowerSync's upload queue sends CRUD batches to `POST /api/sync/upload`:

```json
{
  "uploads": [
    {
      "op": "PATCH",
      "table": "albums",
      "id": "01912345-6789-7abc-8def-0123456789ab",
      "opData": { "notes": "Updated" },
      "opId": 12,
      "clientId": "42",
      "baseVersion": 3
    }
  ]
}
```

The API authenticates the session, resolves the active organisation and applies
each entry in its own transaction:

- `PUT` inserts with the client UUIDv7; an existing row returns
  `already-applied`.
- `PATCH` requires `version = baseVersion`, applies the changed columns and
  increments `version`.
- `DELETE` requires `version = baseVersion` and writes a `deleted_at` tombstone.
- `photos` and `photo_locations` are checked through their parent album;
  `photo_locations` also checks the storage provider's organisation.
- `storage_providers.encrypted_data` is accepted on uploads and preserved as-is
  (it is encrypted at rest; the API never decrypts it during sync).

Results are `applied`, `conflict`, `rejected` or `already-applied`.

### Conflicts

A stale `baseVersion` returns `409` with the current row and version. The mobile
connector:

1. writes the server row locally,
2. re-applies the pending changed columns with the new version,
3. lets PowerSync enqueue a fresh upload.

Rebase is silent. Only a failure to rebase surfaces the generic sync error.

### Idempotency

There is no `sync_mutations` table and no replacement receipts table. Uploads
are at-least-once and idempotent by natural key: inserts use
`on conflict do nothing`, updates reapply the same values, and deletes are
idempotent. A retry after a lost response may increment `version` once more, but
cannot duplicate a row. Do not add a dedupe table without revisiting this
contract.

## Service deployment

The service is configured by `powersync/`:

- `powersync.yaml` — source replication, Postgres bucket storage, JWKS auth, port,
  logging and health checks. Mounted at `/app` (the image's WorkingDir).
- `sync-config.yaml` — the four Sync Streams. Mounted at `/app`.
- `docker-compose.yml` — runs the upstream official image with host network,
  config and env mounted from the repo folder.
- `powersync.env.example` — template for the env file; `powersync.env` holds
  real values and is git-ignored.
- `README.md` — Docker Compose install, start/stop, upgrade, nginx, health and
  rollback.

PowerSync runs from pinned `powersync-ja/powersync-service` release
**v1.28.1** (the upstream official image at `journeyapps/powersync-service`),
managed by Docker Compose as user `paul` (rootless Docker). The container uses
the **host network**, so the service listens on `127.0.0.1:5677` directly and
reaches the API's JWKS at `127.0.0.1:5634` without a docker network. nginx
exposes `/powersync/` with WebSocket upgrade and no buffering.

The bucket-storage backend is PostgreSQL on the existing server, in the
dedicated `powersync` schema, using the `lofipix` user. `reset-database.ts`
ensures the schema and grants but never drops bucket data.

No MongoDB, Redis or other dependencies are required: bucket storage is
PostgreSQL, configured via `PS_STORAGE_URI`.

## Source database

PostgreSQL must have `wal_level = logical`. The `lofipix` role is the owner
of the `lofipix` database (CONNECT, CREATE and SELECT on all schemas come
from ownership) and has the `REPLICATION` attribute. See `powersync/README.md`
for the exact SQL.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PS_POSTGRES_URI` | yes | Source PostgreSQL connection for logical replication. |
| `PS_STORAGE_URI` | yes | Bucket-storage PostgreSQL connection. |
| `PS_PORT` | yes | Service port; `5677`. |
| `PS_LOG_LEVEL` | no | Service log level. |
| `PS_LOG_FORMAT` | no | `text` or `json` (v1.28.1 does not accept `pretty`). |

These live in `powersync/powersync.env` in the repo folder and are read by
`docker-compose.yml`, not by the API.

## Operations

- Health: `curl -fsS http://127.0.0.1:5677/probes/liveness` and
  `/probes/readiness`.
- Logs: `docker compose logs powersync --tail 50`.
- Start/stop: `docker compose up -d` / `docker compose down`.
- Config deploy: the `Deploy PowerSync` GitHub Actions workflow syncs the
  `powersync/` folder to the host, runs `docker compose pull && docker compose
  up -d` and checks health. It never rebuilds the image.
- Upgrade: edit the `image:` tag in `docker-compose.yml`, record it in
  `docs/POWERSYNC.md`, then `docker compose pull && docker compose up -d`.
  Keep the previous image for rollback.

## Troubleshooting

- **401/403 on connect**: check the `organization_id` claim, audience and the
  loopback JWKS URL.
- **No rows for photos/locations**: check the album's organisation and the joins
  in `sync-config.yaml`.
- **Replication errors**: check `wal_level`, `REPLICATION` role attribute and
  the publication.
- **Bucket storage errors**: check `PS_STORAGE_URI` and the `powersync` schema
  grants.
- **Uploads stuck**: inspect `POST /api/sync/upload` responses and
  `docker compose logs powersync`; `409` responses are auto-rebased by the
  connector.
