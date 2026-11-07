# Uptrace

Self-hosted observability for lofipix using Uptrace (OpenTelemetry backend: traces,
metrics, logs). Install Uptrace and ClickHouse on the host and run them under
systemd (Debian 13 / Ubuntu 24.04, amd64 and arm64). Reuse the existing
PostgreSQL cluster for Uptrace metadata in a dedicated `uptrace` database.
Instrument the React website, the React Native mobile app, Hono API, PostgreSQL,
SeaweedFS, image sync pipeline, and mobile upload sync writes.

## PostgreSQL (existing cluster)

Create a dedicated database and role in the shared cluster:

```sh
sudo -u postgres psql <<'SQL'
CREATE USER uptrace WITH PASSWORD 'changeme';
CREATE DATABASE uptrace OWNER uptrace;
SQL
```

Uptrace needs its own database; do not share the lofipix application database or
schema.

## ClickHouse

Install ClickHouse from the official repository:

```sh
curl -fsSL 'https://packages.clickhouse.com/rpm/lts/repodata/repomd.xml.key' | sudo gpg --dearmor -o /usr/share/keyrings/clickhouse-keyring.gpg
echo 'deb [signed-by=/usr/share/keyrings/clickhouse-keyring.gpg] https://packages.clickhouse.com/deb stable main' | sudo tee /etc/apt/sources.list.d/clickhouse.list
sudo apt-get update
sudo apt-get install -y clickhouse-server clickhouse-client
sudo systemctl enable --now clickhouse-server
```

ClickHouse listens on `127.0.0.1:9000` (native) and `8123` (HTTP). It stores
telemetry data; keep it on a volume with adequate retention space.

## Uptrace

Install the Uptrace binary (download the release for your arch from the Uptrace
releases page) to `/usr/local/bin/uptrace` and create a system user and config
directory:

```sh
sudo useradd -r -s /usr/sbin/nologin uptrace
sudo mkdir -p /etc/uptrace /var/lib/uptrace
sudo chown uptrace:uptrace /var/lib/uptrace
```

Create `/etc/uptrace/uptrace.yml`:

```yaml
projects:
  - id: 1
    name: lofipix
    token: <lofipix-project-token>
  - id: 2
    name: spaa
    token: <spaa-project-token>
```

Create `/etc/default/uptrace` (mode 0640, owned by root:uptrace):

```sh
CLICKHOUSE_ADDR=127.0.0.1:9000
POSTGRES_DSN=postgres://uptrace:changeme@127.0.0.1:5432/uptrace?sslmode=disable
UPTRACE_CONFIG=/etc/uptrace/uptrace.yml
```

Create `/etc/systemd/system/uptrace.service`:

```ini
[Unit]
Description=Uptrace observability backend
After=network-online.target postgresql.service clickhouse-server.service
Wants=network-online.target

[Service]
Type=simple
User=uptrace
Group=uptrace
EnvironmentFile=/etc/default/uptrace
ExecStart=/usr/local/bin/uptrace --config=${UPTRACE_CONFIG}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now uptrace
```

Uptrace listens on `127.0.0.1:14317` (OTLP gRPC), `127.0.0.1:14318` (OTLP
HTTP) and `127.0.0.1:8888` (UI). Point clients at the OTLP HTTP endpoint:

```sh
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:14318
```

A single Uptrace instance supports multiple projects; each project has its own
token and isolated data. Use one instance for "lofipix", "spaa", and others.

## Telemetry enrichment

The Hono API proxies OTLP over `/api/telemetry/*` and injects `lofipix.user.id`
and `lofipix.organization.id` as resource attributes (from the authenticated
session) before forwarding to Uptrace. Clients should not send these attributes
themselves. Uptrace dashboards and filters can group by these attributes.

| Layer            | Instrumentation                                                        | Result                                                   |
| ---------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| Mobile app       | Fetch instrumentation, custom spans | Capture, upload, API request and sync upload spans |
| Website          | Fetch/XHR instrumentation, document-load instrumentation               | Page load, TanStack Query request spans, API request spans |
| Hono API         | HTTP instrumentation plus custom spans                                 | Incoming request, validation, business logic, response   |
| PostgreSQL       | Database instrumentation                                               | Query duration, query text, errors                       |
| SeaweedFS        | HTTP/S3 client instrumentation or custom spans                         | Upload/download duration, object key, byte size          |
| Image Sync       | Custom span                                                            | Conversion duration, page number, output dimensions      |
| PowerSync upload | Custom span in the mobile connector and API upload handler             | Applied/conflict/rejected uploads, rebases, retries, queue depth |

Notes:

- Mobile spans come from an OpenTelemetry React Native SDK (fetch auto-instrumentation
  plus manual spans for capture, uploads and PowerSync uploads).
- Website spans use the same browser SDK (fetch/XHR + document-load) without sync spans.
- Hono spans wrap each request (route, validation via Zod, handler logic, response
  status) and propagate trace context to pgmq consumers and SeaweedFS calls.
- PostgreSQL spans record query duration, sanitized query text, and errors.
- Image Sync spans are emitted by the pgmq consumer doing conversion work.
- PowerSync upload spans track the upload pipeline: applied/conflict/rejected
  results, rebases, retries, and queue depth.
