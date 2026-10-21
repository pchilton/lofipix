# Uptrace

Self-hosted observability for lofipix using Uptrace (OpenTelemetry backend: traces,
metrics, logs). Run it locally via Docker; instrument the SolidJS PWA, the Website,
Hono API, PostgreSQL, SeaweedFS, image sync pipeline, and PowerSync writes.

## Self-hosted Docker setup (skeleton)

```yaml
# docker-compose.uptrace.yml (skeleton — fill in versions, volumes, passwords)
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: uptrace
      POSTGRES_USER: uptrace
      POSTGRES_PASSWORD: changeme
    volumes:
      - uptrace-postgres:/var/lib/postgresql/data

  clickhouse:
    image: clickhouse/clickhouse-server:24-alpine
    volumes:
      - uptrace-clickhouse:/var/lib/clickhouse

  uptrace:
    image: uptrace/uptrace:latest
    depends_on:
      - postgres
      - clickhouse
    ports:
      - "14317:14317" # OTLP gRPC
      - "14318:14318" # OTLP HTTP
      - "8888:8888"   # UI
    environment:
      CLICKHOUSE_ADDR: clickhouse:9000
      POSTGRES_DSN: postgres://uptrace:changeme@postgres:5432/uptrace?sslmode=disable
    volumes:
      - ./uptrace.yml:/etc/uptrace/uptrace.yml

volumes:
  uptrace-postgres:
  uptrace-clickhouse:
```

```yaml
# uptrace.yml (skeleton)
# projects:
#   - id: 1
#     name: lofipix
#     token: <project-token>
```

```sh
docker compose -f docker-compose.uptrace.yml up -d
# Open http://localhost:8888, create/use project token, then point
# OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:14318 at it.
```

## Instrumentation map (initial entry)

| Layer            | Instrumentation                                                        | Result                                                   |
| ---------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| SolidJS PWA      | Fetch/XHR instrumentation, document-load instrumentation, custom spans | Browser click, upload, model load, and API request spans |
| Website          | Fetch/XHR instrumentation, document-load instrumentation               | Page load, TanStack Query request spans, API request spans |
| Hono API         | HTTP instrumentation plus custom spans                                 | Incoming request, validation, business logic, response   |
| PostgreSQL       | Database instrumentation                                               | Query duration, query text, errors                       |
| SeaweedFS        | HTTP/S3 client instrumentation or custom spans                         | Upload/download duration, object key, byte size          |
| Image Sync       | Custom span                                                            | Conversion duration, page number, output dimensions      |
| PowerSync writes | Custom span or queue consumer span                                     | Accepted/rejected operations, retries, queue depth       |
```

Notes:

- PWA spans come from an OpenTelemetry browser SDK (fetch/XHR + document-load
  auto-instrumentation plus manual spans for uploads and TanStack Query mutations).
- Website spans use the same browser SDK (fetch/XHR + document-load) without PowerSync spans.
- Hono spans wrap each request (route, validation via Zod, handler logic, response
  status) and propagate trace context to pgmq consumers and SeaweedFS calls.
- PostgreSQL spans record query duration, sanitized query text, and errors.
- Image Sync spans are emitted by the pgmq consumer doing conversion work.
- PowerSync write spans track the upload pipeline: accepted/rejected operations,
  retries, and queue depth.
