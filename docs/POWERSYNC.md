# PowerSync

Self-hosted PowerSync Service for offline-first sync (PostgreSQL → SQLite), published as `journeyapps/powersync-service` on Docker Hub.

The service runs in Docker with `network_mode: host` and listens on port `5636` on the host
(the port comes from the generated `powersync.yaml`, not from a Compose port mapping).
nginx exposes it at `https://<region>.lofipix.app/powersync/` (see `docs/NGINX.md` Route 3).

Everything lives in `scripts/powersync.ts`: the Docker Compose definition, the sync rules
and the service configuration are written to a temporary directory, copied into the container
and the container is started. Nothing is committed that holds credentials.

## Requirements

- PostgreSQL source database with `wal_level = logical`
- A PostgreSQL schema for PowerSync bucket storage (same database is fine, `powersync` schema)
- API server running, exposing JWKS for client tokens
- Docker and Docker Compose
- Bun (the start script runs with Bun, like the other scripts in `scripts/`)

## 1. PostgreSQL setup

Create a replication role and publication on the source database:

```sql
CREATE ROLE powersync_role WITH REPLICATION BYPASSRLS LOGIN PASSWORD '<PASSWORD>';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO powersync_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO powersync_role;
CREATE PUBLICATION powersync FOR ALL TABLES;
```

The bucket storage lives in the `powersync` schema of the same database. PowerSync creates that
schema itself (`CREATE SCHEMA IF NOT EXISTS powersync`) and always uses it: the storage
connection runs `SET search_path TO powersync`, so the bucket tables (`bucket_data`,
`sync_rules`, `instance`, `migrations`, …) are created and read there, never in `public`.
The schema name is hardcoded in the service (`STORAGE_SCHEMA_NAME = 'powersync'`), it cannot
be changed through the configuration or the connection URI.

```sql
CREATE SCHEMA IF NOT EXISTS powersync;
```

## 2. Environment

Configuration comes from `.env.<REGION>` at the repo root (see `.env.example`):

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | Replication source database. |
| `POWERSYNC_JWKS_URL` | yes | JWKS endpoint of the API (client token verification). |
| `POWERSYNC_AUDIENCE` | yes | `aud` the client JWT must carry. Must match what the PWA requests. |
| `POWERSYNC_WAIT_TIMEOUT_MS` | no | Liveness probe timeout. Defaults to `30000`. |

The port is not configurable: the service always listens on `5636` (host networking, no port mapping).
The PostgreSQL `sslmode` is not configurable either, it is always `disable` (private networks only).

## 3. Sync rules

The sync rules are defined in `scripts/powersync.ts` (`SYNC_CONFIG_YAML`):

```yaml
config:
  edition: 3

streams:
  global_albums:
    queries:
      - SELECT id, name, notes FROM albums
```

Replace the `streams` queries with the tables and filters the PWA needs.

## 4. Start the service

```bash
cd scripts
REGION=cholet bun run powersync.ts
```

The script:

1. loads `.env.<REGION>` through `@lofipix/env` (same mechanism as the other scripts),
2. writes `docker-compose.yaml`, `powersync.yaml` and `sync-config.yaml` to a temporary
   directory (`/tmp/lofipix-powersync-*`, mode `0644` inside a `0700` directory),
3. removes any previous container, then `docker compose create` from the temporary directory,
4. copies `powersync.yaml` and `sync-config.yaml` into the container with `docker cp`
   (`/app/powersync.yaml` and `/app/sync-config.yaml`) — **no volumes are used**,
5. runs `docker compose up -d` from the temporary directory, which starts the container
   that was created in step 3 with the configuration already in place,
6. polls `http://127.0.0.1:5636/probes/liveness` until the service answers
   (or `POWERSYNC_WAIT_TIMEOUT_MS` expires), then removes the temporary directory.

Preview the generated files without touching Docker:

```bash
cd scripts
REGION=cholet bun run powersync.ts --dry-run
```

Logs (the temporary directory is removed at the end of the run, use Docker directly):

```bash
docker logs -f powersync
```

## 5. Generated files

`docker-compose.yaml`:

```yaml
name: powersync

services:
  powersync:
    image: journeyapps/powersync-service:latest
    container_name: powersync
    network_mode: "host"
    restart: unless-stopped
    environment:
      NODE_ENV: production
      POWERSYNC_CONFIG_PATH: /app/powersync.yaml
```

`POWERSYNC_CONFIG_PATH` tells the service where to find the configuration copied into the
container. The sync config path inside `powersync.yaml` is absolute (`/app/sync-config.yaml`),
so it does not depend on the working directory.

`powersync.yaml`:

```yaml
replication:
  connections:
    - type: postgresql
      uri: "<DATABASE_URL>"
      sslmode: "disable"

storage:
  type: postgresql
  uri: "<DATABASE_URL>"
  sslmode: "disable"

port: 5636

sync_config:
  path: "/app/sync-config.yaml"

client_auth:
  jwks_uri: "<POWERSYNC_JWKS_URL>"
  audience: ["<POWERSYNC_AUDIENCE>"]
```

## 6. Verify

```bash
curl -i http://127.0.0.1:5636/probes/liveness
curl -i https://<region>.lofipix.app/powersync/probes/liveness
```

Expect `200 OK` from both. The PWA connects to `https://<region>.lofipix.app/powersync`.

## Alternatives

The PowerSync service can also be configured without any file at all, using environment
variables only:

- `POWERSYNC_CONFIG_B64` — base64 of the whole `powersync.yaml`.
- `POWERSYNC_SYNC_CONFIG_B64` — base64 of the sync config YAML.

Substituting variables inside a YAML file is also supported, but only through the `!env` tag
and only for variables prefixed with `PS_` — plain `${VAR}` or `$VAR` placeholders are not
expanded:

```yaml
storage:
  type: postgresql
  uri: !env PS_DATABASE_URL
  sslmode: disable
```

## Troubleshooting

- `pull access denied` — the image is `journeyapps/powersync-service`, not `powersync/powersync-service`.
- Replication errors on start — confirm `wal_level = logical` and that the publication exists.
- Client auth rejected — the JWT `aud` must match `client_auth.audience` and `kid` must match a key in the JWKS.
- Service exits immediately — the configuration is only read at start-up; re-run the script after changing `.env.<REGION>`.
- Stale configuration in the container — `scripts/powersync.ts` recreates the container on every run; a plain `docker compose up -d` would keep the previously copied files.
