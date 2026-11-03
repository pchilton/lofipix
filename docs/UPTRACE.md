# Uptrace

Self-hosted observability for lofipix using Uptrace (OpenTelemetry backend: traces,
metrics, logs). Run it locally via Docker; instrument the React website, the
React Native mobile app, Hono API, PostgreSQL, SeaweedFS, image sync pipeline,
and mobile outbox sync writes.

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
# Open http://192.168.1.15:8888, create/use project token, then point
# OTEL_EXPORTER_OTLP_ENDPOINT=http://192.168.1.15:14318 at it.
```

## Instrumentation map (initial entry)

| Layer            | Instrumentation                                                        | Result                                                   |
| ---------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| Mobile app       | Fetch instrumentation, custom spans | Capture, upload, API request and outbox spans |
| Website          | Fetch/XHR instrumentation, document-load instrumentation               | Page load, TanStack Query request spans, API request spans |
| Hono API         | HTTP instrumentation plus custom spans                                 | Incoming request, validation, business logic, response   |
| PostgreSQL       | Database instrumentation                                               | Query duration, query text, errors                       |
| SeaweedFS        | HTTP/S3 client instrumentation or custom spans                         | Upload/download duration, object key, byte size          |
| Image Sync       | Custom span                                                            | Conversion duration, page number, output dimensions      |
| Outbox sync      | Custom span in the mobile app and API mutation handler                 | Accepted/rejected mutations, conflicts, retries, queue depth |
```

Notes:

- Mobile spans come from an OpenTelemetry React Native SDK (fetch auto-instrumentation
  plus manual spans for capture, uploads and outbox mutations).
- Website spans use the same browser SDK (fetch/XHR + document-load) without sync spans.
- Hono spans wrap each request (route, validation via Zod, handler logic, response
  status) and propagate trace context to pgmq consumers and SeaweedFS calls.
- PostgreSQL spans record query duration, sanitized query text, and errors.
- Image Sync spans are emitted by the pgmq consumer doing conversion work.
- Outbox sync spans track the mutation pipeline: applied/conflict/rejected
  results, retries, and queue depth.
