# PowerSync

Self-hosted PowerSync Service for offline-first sync (PostgreSQL → SQLite).

PWA connects via nginx at `https://<host>/powersync/` → `http://127.0.0.1:5636`.

## Requirements

- PostgreSQL with logical replication enabled (`wal_level = logical`)
- API server running
- nginx reverse proxy (see `docs/NGINX.md` Route 3)

## Installation (Docker)

Create `powersync.yaml` next to `docker-compose.yaml` (do not commit secrets; use `.env.<REGION>`):

```yaml
replication:
  connections:
    - type: postgresql
      uri: ${DATABASE_URL}
      slot_name: powersync_slot
      publications:
        - powersync_pub

storage:
  type: postgresql
  # Defaults to DATABASE_URL. Set POWERSYNC_STORAGE_URL in .env to point
  # PowerSync at a separate storage database (e.g. powersync).
  uri: ${POWERSYNC_STORAGE_URL:-${DATABASE_URL}}

api:
  # JWT public key / JWKS URL used to verify client tokens issued by the API
  jwt:
    jwks_uri: ${POWERSYNC_JWKS_URL}

client_auth:
  # Audience that client JWTs must target (must match POWERSYNC_AUDIENCE in .env)
  audience: ['powersync-<region>']
```

`docker-compose.yaml`:

```yaml
services:
  powersync:
    image: powersync/powersync-service:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:5636:8080"
    volumes:
      - ./powersync.yaml:/app/powersync.yaml:ro
    env_file:
      - ../.env.${REGION:-cholet}
    command: ["--config", "/app/powersync.yaml"]
```

Start:

```bash
docker compose up -d powersync
docker compose logs -f powersync
```

## PostgreSQL setup

Run the following as the PostgreSQL superuser (e.g. `psql -U postgres`).

### PowerSync storage database

PowerSync stores its internal state (sync checkpoints, operation log) in a
dedicated database. The app user `lofipix` owns it and the PowerSync Service
connects to it using the `lofipix` credentials.

```sql
-- Create the storage database, owned by the app user
CREATE DATABASE powersync OWNER lofipix;

-- Allow the app user to connect and use it
GRANT ALL PRIVILEGES ON DATABASE powersync TO lofipix;
GRANT CONNECT ON DATABASE powersync TO lofipix;
```

### Replication permissions (source database)

PowerSync reads change data from the `lofipix` database via logical
replication. The `DATABASE_URL` user needs the `REPLICATION` privilege.

```sql
-- Grant replication to the app user
ALTER ROLE lofipix WITH REPLICATION;

-- Alternatively, use a dedicated replication role and point
-- DATABASE_URL at it:
-- CREATE ROLE powersync_replication WITH REPLICATION LOGIN PASSWORD '<password>';
-- GRANT CONNECT ON DATABASE lofipix TO powersync_replication;
```

### Publication for synced tables

```sql
-- Publication for synced tables (add tables as needed)
CREATE PUBLICATION powersync_pub FOR TABLE organisations, albums, photos;

-- Replication slot is created automatically by the service on first connect.
```

Ensure `DATABASE_URL` user has `REPLICATION` privilege or is superuser.

> If you use a separate `powersync` database for storage, set
> `POWERSYNC_STORAGE_URL` in `.env.<REGION>` and reference it in
> `powersync.yaml` (`storage.uri: ${POWERSYNC_STORAGE_URL}`). The current
> template uses `${DATABASE_URL}` for both replication and storage.

## Environment variables (`.env.<REGION>`)

| Var | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (source of truth) |
| `POWERSYNC_JWKS_URL` | JWKS URL served by the API for client token verification, e.g. `https://oceania.lofipix.app/api/auth/jwks.json` |
| `POWERSYNC_AUDIENCE` | Audience the client JWT must target. Must match `client_auth.audience` in the PowerSync service config, e.g. `powersync-oceania` |

## JWT signing algorithm

The API signs PowerSync client JWTs with **EdDSA / Ed25519** (Better Auth `jwt()` plugin default). PowerSync verifies via the JWKS at `POWERSYNC_JWKS_URL`.

Required JWT claims for PowerSync:

| Claim | Value |
| --- | --- |
| `sub` | user id |
| `aud` | `POWERSYNC_AUDIENCE` |
| `iat` / `exp` | `exp - iat <= 86400` (<= 24h, <= 60m recommended) |
| `kid` | matches a key in the JWKS |

Extra claims (e.g. `organization_id`) are passed through and available to sync rules via `auth.parameters()`.

## Verify

```bash
curl -i http://127.0.0.1:5636/health
curl -i https://oceania.lofipix.app/powersync/health
```

Expect `200 OK` from both.
