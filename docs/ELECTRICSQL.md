# ElectricSQL

ElectricSQL is the sync engine for the PWA. PostgreSQL remains the source of
truth; Electric streams table shapes to the browser, the PWA stores them in
PGlite (PostgreSQL compiled to WebAssembly) and TanStack DB provides the
reactive collections the UI reads.

```text
PostgreSQL ──logical replication──► Electric (loopback :5637)
                                         ▲
                                         │ shape requests (secret injected server-side)
                                         │
PWA ──cookie session──► API /api/sync/shapes/:table ──► Electric
 │
 ├─► PGlite (`idb://lofipix`) ◄── shape messages
 ├─► TanStack DB collections (tanstack-db-pglite)
 └─► outbox (PGlite) ──POST /api/sync/mutations──► API ──► PostgreSQL
```

## Requirements

- PostgreSQL 14+ with `wal_level = logical`.
- A database role used by Electric with `REPLICATION`.
- Docker and Docker Compose.
- Bun for `scripts/electric.ts`.

Electric manages the `electric_publication_default` publication and adds
tables to it automatically. If the Electric role cannot alter application
tables, set `ELECTRIC_MANUAL_TABLE_PUBLISHING=true` and add each synced table:

```sql
BEGIN;
ALTER PUBLICATION electric_publication_default ADD TABLE public.albums;
ALTER TABLE public.albums REPLICA IDENTITY FULL;
COMMIT;
```

Repeat for `photos`, `photo_locations` and `storage_providers`.

## Environment

Configuration comes from `.env.<REGION>` (see `.env.example`):

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | Database Electric replicates from. |
| `ELECTRIC_SECRET` | yes | Shared secret for shape requests. The API injects it; clients never see it. |
| `ELECTRIC_INTERNAL_URL` | no | API-side Electric URL. Default `http://127.0.0.1:5637`. |
| `ELECTRIC_WAIT_TIMEOUT_MS` | no | Start-script health-check timeout. Default `30000`. |

## Start the service

```bash
cd scripts
REGION=cholet bun run electric
```

`scripts/electric.ts` writes a temporary Compose file, starts
`electricsql/electric` behind a Docker bridge network with a loopback-only
port mapping (`127.0.0.1:5637 -> 3000`), a persistent `electric-data` volume
mounted at `/var/lib/electric`, and waits for
`http://127.0.0.1:5637/v1/health`. If `DATABASE_URL` points at `localhost` or
`127.0.0.1`, the script rewrites the host to `host.docker.internal` so the
container can reach PostgreSQL on the host.

Preview the generated file:

```bash
cd scripts
REGION=cholet bun run electric -- --dry-run
```

Electric must not be exposed publicly. Only the API talks to it, over
loopback. Logs: `docker logs -f electric`.

## Shape proxy

The PWA never holds an Electric URL or secret. It requests
`GET /api/sync/shapes/:table` (or `POST` for subset snapshots). The API:

1. authenticates the Better Auth session;
2. resolves the single active organisation;
3. whitelists the table (`albums`, `photos`, `photo_locations`,
   `storage_providers`);
4. forwards only `ELECTRIC_PROTOCOL_QUERY_PARAMS` from the client;
5. sets `table`, `where organization_id = $1`, `params[1]`, `columns` and
   `secret` server-side;
6. streams the response with `Cache-Control: no-store` and `Vary: Cookie`.

`storage_providers` excludes the server-only `encrypted_data` column. The
public `config` object is synced.

Shapes include tombstones (`deleted_at` is not filtered), so deletes reach
every device. The PWA filters `deleted_at is null` in live queries.

`docs/NGINX.md` documents the streaming requirements for the API route.

## Local database

- PGlite runs in the browser with the IndexedDB VFS: `idb://lofipix`.
  OPFS AHP is not used because it requires a worker and is unsupported in
  Safari; photo bytes remain in OPFS.
- A Web Lock (`lofipix-db`) gives one tab exclusive access. Other tabs show an
  "already open" state.
- `pwa/src/lib/db/schema.ts` defines the local tables. They mirror the public
  columns plus a client-only `outbox_needed` flag. Local tables intentionally
  have no foreign keys, so shape delivery order cannot fail a write.
- `tanstack-db-pglite` hydrates a TanStack DB collection from each local table.
- Electric rows are written through the adapter's `sync` callback using
  `ShapeStream` with `snakeCamelMapper`, a `timestamptz`/`int8` parser and a
  `fetchClient` that sends cookies. `must-refetch` clears non-pending local
  rows and replays the snapshot.
- A record with a pending outbox entry ignores incoming shape messages until
  its mutation is resolved, so an older echo cannot clobber an optimistic edit.

## Local schema snapshot

`drizzle-kit push` is the schema-as-source-of-truth workflow for the local
database too. It runs at build time because the browser cannot run CLI tools.

```bash
cd pwa
bun run snapshot        # writes public/pglite/schema-v<version>.tar.gz
bun run snapshot --force
```

The script creates a throwaway PGlite data dir, runs
`drizzle-kit push --driver pglite`, inserts the schema version into
`local_meta`, dumps the data dir and writes a versioned archive.
`predev`/`prebuild` run it automatically. The archive is gitignored and must
be regenerated when `@electric-sql/pglite` or the local schema changes; bump
`LOCAL_SCHEMA_VERSION` in `pwa/src/lib/db/schema.ts` in the same change.

On first run the PWA loads the archive with `PGlite.create(..., {
loadDataDir })`. The current version lives in `local_meta.schema_version`.
If `indexedDB.databases()` is unavailable, the first-run check falls back to
opening the existing data dir when PGlite reports that the database already
exists, so the snapshot is only loaded into an empty data dir.

## Upgrades

Synced rows are a cache; the outbox is the only durable local work. VitePWA
uses `registerType: 'prompt'` and `injectRegister: false`.
`pwa/src/lib/update.ts` waits until:

- the new service worker is waiting,
- the device is online,
- the outbox has no pending/inflight/failed mutations, and
- all four shapes report up-to-date.

Only then does it activate the new worker and reload. The old cached app and
schema keep working offline. After activation, `initLocalDatabase` sees the
old `schema_version`, confirms the outbox is drained, deletes the `lofipix`
IndexedDB database, loads the new snapshot and resyncs. OPFS photo bytes are
untouched. Dead mutations are terminal and do not block an upgrade; they are
retried once on the next app start.

## Outbox and sync contract

Client-only `outbox` table:

| Column | Meaning |
| --- | --- |
| `id` | Mutation id (UUIDv7), the server idempotency key. |
| `organization_id` | Tenant. |
| `table_name` | One of the four synced tables. |
| `record_id` | Row id. |
| `operation` | `insert`, `update` or `delete` (soft delete). |
| `payload` | Full row for inserts; changed columns for updates; `{}` for deletes. |
| `base_version` | Version the edit was based on; `0` for inserts. |
| `status` | `pending`, `inflight`, `failed` or `dead`. |
| `attempt_count`, `next_attempt_at`, `last_error` | Retry state. |

Every synced local table has `outbox_needed boolean default false`, a
client-only marker. A local write sets it to `true`; after the outbox row is
written the marker is cleared. Row write and outbox insert are not atomic; on
startup `reconcileOutbox` finds flagged rows without an outbox entry and
enqueues them. Duplicate detection is by record, operation, base version and
payload.

Coalescing keeps at most one pending mutation per record: insert + updates
become one insert, delete supersedes updates, and an offline insert followed
by a delete is dropped entirely. In-flight rows are immutable. The sender
serialises one mutation per record at a time and refreshes `base_version` from
the local row immediately before sending.

`POST /api/sync/mutations` accepts `{ mutations: [...] }` (max 500). Each
mutation is applied in its own transaction:

- `insert` uses the client UUIDv7, sets `version = 1` and returns a conflict
  with the current row if the id already exists;
- `update`/`delete` require `version = base_version`; stale writes return
  `409`-equivalent `conflict` results with the current row;
- deletes are soft deletes (`deleted_at = now()`, `version + 1`);
- photo and photo-location mutations verify their parent rows belong to the
  same organisation;
- `storage_providers` never accepts `encrypted_data` from a client.

Responses contain one result per mutation:
`applied`, `conflict`, `rejected` or `duplicate`, with `version`/`row` when
available. `sync_mutations` stores the result under the mutation id so a retry
after a lost response does not reapply it.

The client applies the returned row/version, removes the outbox entry, and
retargets any remaining pending mutations for that record to the new version.
A conflict replaces the local row with the server row, discards that record's
pending mutations and shows the generic sync error. Rejections become `dead`.
Retries use exponential backoff; after 10 attempts a mutation is `dead` and is
retried once on the next app start.

The sync chip shows pending count and a generic error. A full outbox screen is
a follow-up.

## Sync columns and indexes

All four synced tables have:

- `organization_id text not null` referencing `auth.organization(id)`;
- `version bigint not null default 1`, incremented server-side on every write;
- server-assigned `updated_at`;
- `deleted_at` tombstones.

`photos` and `photo_locations` use composite tenant foreign keys so a child
cannot reference a parent in another organisation. `storage_providers` keeps
its `config` JSONB public and stores secrets in a separate server-only
`encrypted_data` JSONB column, which the shape excludes.

## Verification

```bash
curl -i http://127.0.0.1:5637/v1/health
REGION=cholet bun scripts/reset-database.ts
```

From a signed-in browser session, the four shape requests should return
`200` and stream JSON/SSE. A `401` means the session is missing; a `503` means
`ELECTRIC_SECRET` or Electric is unavailable.

## Troubleshooting

- **Electric cannot decode WAL** — check `wal_level = logical` and the
  replication role.
- **Shape 500 / no such table** — the table is not in the publication. Let
  Electric manage publication, or add it manually.
- **`401`/`403` from the proxy** — the PWA session cookie is missing or the
  user has no single active organisation.
- **No live updates** — check `proxy_buffering off` on the API route in nginx;
  the proxy must not buffer SSE.
- **Schema mismatch on startup** — the service worker activated while the
  outbox was not drained, or the snapshot was regenerated with a different
  PGlite version. Regenerate the snapshot and reload.
- **Safari cannot open the database** — the PWA must use IndexedDB, not the
  OPFS AHP VFS.
