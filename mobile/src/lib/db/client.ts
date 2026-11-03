import { open, type DB } from '@op-engineering/op-sqlite';
import { drizzle, type OPSQLiteDatabase } from 'drizzle-orm/op-sqlite';
import NetInfo from '@react-native-community/netinfo';

import { schemaStatements } from './ddl';
import * as schema from './schema';
import { LOCAL_SCHEMA_VERSION } from './schema';

const DATABASE_NAME = 'lofipix';

let client: DB | undefined;
let database: OPSQLiteDatabase<typeof schema> | undefined;
let initializing: Promise<OPSQLiteDatabase<typeof schema>> | undefined;

export class LocalDatabaseUpgradeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocalDatabaseUpgradeError';
  }
}

async function readSchemaVersion(db: DB): Promise<string | null> {
  try {
    const result = await db.execute(
      "select value from local_meta where key = 'schema_version' limit 1",
    );
    const row = result.rows[0] as { value?: string } | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function countBlockingOutbox(db: DB): Promise<number> {
  try {
    const result = await db.execute(
      "select count(*) as count from outbox where status in ('pending', 'inflight', 'failed')",
    );
    const row = result.rows[0] as { count?: number | string } | undefined;
    return Number(row?.count ?? 0);
  } catch {
    return 0;
  }
}

async function writeSchemaVersion(db: DB): Promise<void> {
  await db.execute(
    "insert into local_meta (key, value) values ('schema_version', ?) on conflict (key) do update set value = excluded.value",
    [String(LOCAL_SCHEMA_VERSION)],
  );
}

async function applySchema(db: DB): Promise<void> {
  await db.executeBatch(schemaStatements.map((statement) => [statement]));
  await writeSchemaVersion(db);
}

export function shouldRebuildCache(pending: number, online: boolean): boolean {
  return pending === 0 && online;
}

async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected !== false;
}

function closeClient(): void {
  if (client) {
    client.close();
    client = undefined;
  }
}

async function openDatabase(): Promise<DB> {
  const opened = open({ name: DATABASE_NAME });
  const version = await readSchemaVersion(opened);

  if (version === String(LOCAL_SCHEMA_VERSION)) {
    return opened;
  }

  if (version !== null) {
    const pending = await countBlockingOutbox(opened);
    if (!shouldRebuildCache(pending, await isOnline())) {
      opened.close();
      throw new LocalDatabaseUpgradeError(
        'This device has unsynced work or is offline. Connect to the internet and let the app finish syncing before updating.',
      );
    }
    opened.close();
    opened.delete();
    const fresh = open({ name: DATABASE_NAME });
    await applySchema(fresh);
    return fresh;
  }

  await applySchema(opened);
  return opened;
}

export async function initLocalDatabase(): Promise<OPSQLiteDatabase<typeof schema>> {
  if (database) {
    return database;
  }
  if (!initializing) {
    initializing = (async () => {
      client = await openDatabase();
      database = drizzle(client, { schema });
      return database;
    })();
  }
  return initializing;
}

export function getDb(): OPSQLiteDatabase<typeof schema> {
  if (!database) {
    throw new Error('The local database has not been initialised.');
  }
  return database;
}

export function getClient(): DB {
  if (!client) {
    throw new Error('The local database has not been initialised.');
  }
  return client;
}

export async function clearLocalDatabase(): Promise<void> {
  closeClient();
  database = undefined;
  initializing = undefined;
  const reopened = open({ name: DATABASE_NAME });
  reopened.delete();
}

export function resetLocalDatabaseForTests(): void {
  closeClient();
  database = undefined;
  initializing = undefined;
}
