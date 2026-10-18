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
  uri: ${DATABASE_URL}

api:
  # JWT public key / JWKS URL used to verify client tokens issued by the API
  jwt:
    jwks_uri: ${POWERSYNC_JWKS_URL}
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

```sql
-- Publication for synced tables (add tables as needed)
CREATE PUBLICATION powersync_pub FOR TABLE organisations, albums, photos;

-- Replication slot is created automatically by the service on first connect.
```

Ensure `DATABASE_URL` user has `REPLICATION` privilege or is superuser.

## Environment variables (`.env.<REGION>`)

| Var | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (source of truth) |
| `POWERSYNC_JWKS_URL` | JWKS URL served by the API for client token verification, e.g. `https://oceania.lofipix.app/api/auth/jwks.json` |

## Verify

```bash
curl -i http://127.0.0.1:5636/health
curl -i https://oceania.lofipix.app/powersync/health
```

Expect `200 OK` from both.
