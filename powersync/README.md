# PowerSync service

Self-hosted PowerSync for lofipix, run with Docker Compose by user `paul`
(rootless Docker). Postgres is both the source database and the bucket-storage
backend (dedicated `powersync` schema).

The API issues short-lived JWTs from `POST /api/sync/token`; the mobile app
connects to `https://<region>.lofipix.app/powersync/`; uploads go to
`POST /api/sync/upload`.

## Prerequisites

- Debian 13 / Ubuntu 24.04, Docker (rootless, user `paul`), git.
- PostgreSQL 14+ with `wal_level = logical`.
- The API is running and serving `/api/auth/jwks` on `127.0.0.1:5634`.
- The `lofipix` database user is the **owner** of the `lofipix` database
  (CONNECT, CREATE and SELECT on all schemas are granted by ownership) and
  has the `REPLICATION` attribute. The API and PowerSync both connect as
  `lofipix` over `127.0.0.1`.

```sql
-- lofipix owns the database, so CONNECT, CREATE and SELECT on all schemas
-- come from ownership. Only REPLICATION is added explicitly.
ALTER ROLE lofipix WITH REPLICATION;
```

`REGION=cholet bun scripts/reset-database.ts` also ensures the `powersync`
schema and grants, but intentionally never drops bucket-storage data.

## Install

Pinned release: **v1.28.1** (v1.28.x line), from the upstream official image
`journeyapps/powersync-service` on Docker Hub. Record the tag in
`docs/POWERSYNC.md` when bumping.

No image build is needed — `docker-compose.yml` pulls the official image and
mounts config from the repo folder.

## Configure

`powersync.yaml` and `sync-config.yaml` are committed in `powersync/` and mounted
read-only into the container at `/app` (the image's WorkingDir), where the
service reads `powersync.yaml` from CWD.

Copy `powersync.env.example` to `powersync.env` and fill in real values
(`powersync.env` is git-ignored):

```bash
cp powersync.env.example powersync.env
# edit powersync.env
```

```bash
PS_POSTGRES_URI=postgres://lofipix:...@127.0.0.1:5432/lofipix
PS_STORAGE_URI=postgres://lofipix:...@127.0.0.1:5432/lofipix
PS_PORT=5677
PS_LOG_LEVEL=info
PS_LOG_FORMAT=text
```

`docker-compose.yml` loads this file with `env_file:`, which reads it
verbatim into the container. Do **not** use `environment:` with `${VAR}`
interpolation — that reads the shell environment or `.env`, not this file,
and the container would start with blank values.

`PS_LOG_FORMAT` accepts `text` or `json` (v1.28.1 does not accept
`pretty`).

## Start / stop

```bash
docker compose up -d      # start in background
docker compose down       # stop and remove the container
docker compose logs -f    # follow logs
docker compose restart    # restart
```

PowerSync creates/uses its logical-replication publication on first start. If
the role cannot create it, create the publication manually and restart.

## How it connects

The container uses the **host network** (`network_mode: host`), so:

- PowerSync binds `5677` directly on the host — no port mapping.
- The JWKS endpoint at `http://127.0.0.1:5634/api/auth/jwks` is reached by
  connecting to the API service running on the same host, with no docker
  network needed.
- `PS_POSTGRES_URI` and `PS_STORAGE_URI` connect to PostgreSQL on
  `127.0.0.1` as before.

## Verify

```bash
curl -fsS http://127.0.0.1:5677/probes/liveness
curl -fsS http://127.0.0.1:5677/probes/readiness
docker compose logs powersync --tail 50
```

The service is bound to loopback. nginx is the only public entrypoint.

## nginx

```nginx
location /powersync/ {
    proxy_pass http://127.0.0.1:5677/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

Clients authenticate with the JWT from `POST /api/sync/token`; the JWKS URL is
loopback-only and uses the `lofipix` audience.

## Upgrade and rollback

1. Record the new tag in `docs/POWERSYNC.md`.
2. Edit the `image:` line in `docker-compose.yml`.
3. `docker compose pull && docker compose up -d`.
4. Run both probes. To rollback, restore the previous tag and repeat.

## Requirements beyond the basic image

The upstream image is sufficient. No MongoDB, Redis or other dependencies are
needed because bucket storage is PostgreSQL, configured via `PS_STORAGE_URI`.

The only additions are:

- **Host network** — so PowerSync binds `5677` on the host and reaches the
  API's JWKS at `127.0.0.1:5634` directly.
- **Mounted config** — `powersync.yaml` and `sync-config.yaml` are bind-mounted
  read-only from the repo folder, so config edits take effect on
  `docker compose up -d` without rebuilding.
- **`powersync.env`** — environment variables supplied to the container; never
  committed.

## Troubleshooting

- **401/403 from clients**: the token is missing `organization_id`, has the
  wrong audience, or the JWKS endpoint is unreachable from the service.
- **No rows on device**: check the user's active organisation, the
  `organization_id` claim, and the joins for `photos`/`photo_locations`.
- **Replication errors**: verify `wal_level = logical`, the `REPLICATION` role
  attribute and the publication.
- **Bucket storage errors**: verify `PS_STORAGE_URI`, the `powersync` schema
  and that `lofipix` can `CREATE` in it.
- **Uploads stuck**: check the API upload endpoint and
  `docker compose logs powersync`; `409` responses are auto-rebased by the
  mobile connector.