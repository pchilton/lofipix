# PowerSync service

Self-hosted PowerSync for lofipix. The service runs natively under systemd; it
does not use Docker. Postgres is both the source database and the bucket-storage
backend (dedicated `powersync` schema).

The API issues short-lived JWTs from `POST /api/sync/token`; the mobile app
connects to `https://<region>.lofipix.app/powersync/`; uploads go to
`POST /api/sync/upload`.

## Prerequisites

- Debian 13 / Ubuntu 24.04, Node.js 22+, pnpm, git.
- PostgreSQL 14+ with `wal_level = logical`.
- The API is running and serving `/api/auth/jwks` on `127.0.0.1:5634`.
- The `lofipix` database user can read the four synced tables, create/alter the
  PowerSync publication, and use the `powersync` schema.

```sql
ALTER ROLE lofipix WITH REPLICATION;
GRANT SELECT ON
  public.albums,
  public.photos,
  public.photo_locations,
  public.storage_providers
TO lofipix;
GRANT CONNECT, CREATE ON DATABASE lofipix TO lofipix;

CREATE SCHEMA IF NOT EXISTS powersync;
GRANT USAGE, CREATE ON SCHEMA powersync TO lofipix;
```

`REGION=cholet bun scripts/reset-database.ts` also ensures the `powersync`
schema and grants, but intentionally never drops bucket-storage data.

## Install the pinned service

Pinned release: **v1.28.1** (v1.28.x line).

The upstream project is `powersync-ja/powersync-service`. Upstream publishes a
Docker image; this deployment builds the same service from source.

```bash
sudo useradd --system --home /opt/powersync --shell /usr/sbin/nologin powersync
sudo git clone https://github.com/powersync-ja/powersync-service /opt/powersync
cd /opt/powersync
sudo git checkout v1.28.1   # pinned release; record the tag in docs/POWERSYNC.md and the deploy PR
sudo corepack enable
sudo pnpm install --frozen-lockfile
sudo pnpm build
```

Verify the built entrypoint against the pinned release's README. The systemd
unit assumes `service/dist/bin.js`; if the release uses another entrypoint,
update `ExecStart` in `powersync/powersync.service` and record the change.

Create the runtime user directories:

```bash
sudo mkdir -p /etc/powersync/lofipix /var/lib/powersync
sudo chown -R powersync:powersync /var/lib/powersync
```

## Configure

`service.yaml` is copied to `/etc/powersync/lofipix/service.yaml`.
`sync-config.yaml` is copied next to it.

Create `/etc/powersync/lofipix/powersync.env` (mode `0640`, root:powersync) with
the values from `.env.<region>`:

```bash
PS_POSTGRES_URI=postgres://lofipix:...@127.0.0.1:5432/lofipix
PS_STORAGE_URI=postgres://lofipix:...@127.0.0.1:5432/lofipix
PS_PORT=8080
PS_LOG_LEVEL=info
PS_LOG_FORMAT=pretty
```

Install the unit:

```bash
sudo cp powersync/powersync.service /etc/systemd/system/powersync.service
sudo systemctl daemon-reload
sudo systemctl enable --now powersync
```

PowerSync creates/uses its logical-replication publication on first start. If
the role cannot create it, create the publication manually for the four tables
and restart the service.

## Verify

```bash
curl -fsS http://127.0.0.1:8080/probes/liveness
curl -fsS http://127.0.0.1:8080/probes/readiness
sudo systemctl status powersync --no-pager
sudo journalctl -u powersync -f
```

The service is bound to loopback. nginx is the only public entrypoint.

## nginx

```nginx
location /powersync/ {
    proxy_pass http://127.0.0.1:8080/;
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
loopback-only and uses the `powersync` audience.

## Upgrade and rollback

1. Stop the unit: `sudo systemctl stop powersync`.
2. Check out the new pinned tag in `/opt/powersync`, rebuild, and update the
   recorded version in `docs/POWERSYNC.md`.
3. Keep the previous checkout/tag available for rollback.
4. `sudo systemctl start powersync` and run both probes.

The `Deploy PowerSync` GitHub Actions workflow only syncs `powersync/` config,
reloads systemd and restarts the unit. It never rebuilds the service from
source.

## Troubleshooting

- **401/403 from clients**: the token is missing `organization_id`, has the
  wrong audience, or the JWKS endpoint is unreachable from the service.
- **No rows on device**: check the user's active organisation, the
  `organization_id` claim, and the joins for `photos`/`photo_locations`.
- **Replication errors**: verify `wal_level = logical`, the `REPLICATION` role
  attribute, table `SELECT` grants and the publication.
- **Bucket storage errors**: verify `PS_STORAGE_URI`, the `powersync` schema and
  that `lofipix` can `CREATE` in it.
- **Uploads stuck**: check the API upload endpoint and `journalctl -u powersync`;
  `409` responses are auto-rebased by the mobile connector.
