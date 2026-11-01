import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from './schema';
import { LOCAL_SCHEMA_VERSION } from './schema';

const DATA_DIR = 'idb://lofipix';
const DATABASE_NAME = '/pglite/lofipix';

let database: PgliteDatabase<typeof schema> | undefined;
type PGliteInstance = PGlite;

let pglite: PGliteInstance | undefined;
let initializing: Promise<PgliteDatabase<typeof schema>> | undefined;

export class LocalDatabaseUpgradeError extends Error {}

function snapshotUrl(): string {
  return `${import.meta.env.BASE_URL}pglite/schema-v${LOCAL_SCHEMA_VERSION}.tar.gz`;
}

async function loadSnapshot(): Promise<PGliteInstance> {
  const response = await fetch(snapshotUrl(), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(
      `The local database snapshot is missing (${response.status}). Rebuild the PWA.`,
    );
  }
  const loadDataDir = await response.blob();
  return (await PGlite.create(DATA_DIR, { loadDataDir })) as PGlite;
}

async function databaseExists(): Promise<boolean> {
  if (typeof indexedDB.databases !== 'function') {
    return false;
  }
  const databases = await indexedDB.databases();
  return databases.some((database) => database.name === DATABASE_NAME);
}

async function deleteIndexedDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error('Could not delete the local database.'));
    request.onblocked = () =>
      reject(
        new Error(
          'The local database is still open in another tab. Close it and reload.',
        ),
      );
  });
}

async function readSchemaVersion(pg: PGliteInstance): Promise<string | null> {
  try {
    const result = await pg.query<{ value: string }>(
      "select value from local_meta where key = 'schema_version' limit 1",
    );
    return result.rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function countOutbox(pg: PGliteInstance): Promise<number> {
  try {
    const result = await pg.query<{ count: string }>(
      "select count(*)::text as count from outbox where status in ('pending', 'inflight', 'failed')",
    );
    return Number(result.rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

async function writeSchemaVersion(pg: PGliteInstance): Promise<void> {
  await pg.query(
    `insert into local_meta (key, value) values ('schema_version', $1)
     on conflict (key) do update set value = excluded.value`,
    [String(LOCAL_SCHEMA_VERSION)],
  );
}

async function loadFreshDatabase(): Promise<PGliteInstance> {
  const fresh = await loadSnapshot();
  await writeSchemaVersion(fresh);
  return fresh;
}

async function openDatabase(): Promise<PGliteInstance> {
  if (!(await databaseExists())) {
    try {
      return await loadFreshDatabase();
    } catch (error) {
      if (!(error instanceof Error && /already exists/i.test(error.message))) {
        throw error;
      }
    }
  }

  const pg = (await PGlite.create(DATA_DIR)) as PGlite;
  const version = await readSchemaVersion(pg);

  if (version === String(LOCAL_SCHEMA_VERSION)) {
    return pg;
  }

  if (version !== null) {
    const pending = await countOutbox(pg);
    if (pending > 0 || !navigator.onLine) {
      await pg.close();
      throw new LocalDatabaseUpgradeError(
        'This device has unsynced work or is offline. Connect to the internet and let the app finish syncing before updating.',
      );
    }
  }

  await pg.close();
  await deleteIndexedDatabase();
  if (await databaseExists()) {
    throw new Error('Could not replace the local database. Close other tabs and reload.');
  }
  return loadFreshDatabase();
}

export async function initLocalDatabase(): Promise<PgliteDatabase<typeof schema>> {
  if (database) {
    return database;
  }
  if (!initializing) {
    initializing = (async () => {
      pglite = await openDatabase();
      database = drizzle(pglite, { schema });
      return database;
    })();
  }
  return initializing;
}

export function getDb(): PgliteDatabase<typeof schema> {
  if (!database) {
    throw new Error('The local database has not been initialised.');
  }
  return database;
}

export function getPglite(): PGliteInstance {
  if (!pglite) {
    throw new Error('The local database has not been initialised.');
  }
  return pglite;
}

export async function clearLocalDatabase(): Promise<void> {
  if (pglite) {
    await pglite.close();
  }
  pglite = undefined;
  database = undefined;
  initializing = undefined;
  await deleteIndexedDatabase();
}
