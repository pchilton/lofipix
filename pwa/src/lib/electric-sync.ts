import {
  FetchError,
  ShapeStream,
  isChangeMessage,
  isControlMessage,
  snakeCamelMapper,
} from '@electric-sql/client';
import { sql } from 'drizzle-orm';
import type { SyncTable } from '@lofipix/db/schema';
import { config } from './config';
import { getDb } from './db/client';
import { pendingIds } from './outbox';
import { updateShape } from './sync-status';

type WriteMessage =
  | { type: 'insert' | 'update'; value: Record<string, unknown> }
  | { type: 'delete'; key: string };

interface SyncParams {
  writeAsync: (message: WriteMessage) => Promise<void>;
  collection: {
    get: (key: string) => unknown;
    getKeyFromItem: (item: Record<string, unknown>) => string;
  };
  markReady: () => void;
}

async function rowExists(table: SyncTable, key: string): Promise<boolean> {
  const result = await getDb().execute<{ id: string }>(
    sql`select id from ${sql.identifier(table)} where id = ${key} limit 1`,
  );
  return result.rows.length > 0;
}

async function resetTable(
  table: SyncTable,
  writeAsync: SyncParams['writeAsync'],
): Promise<void> {
  const result = await getDb().execute<{ id: string }>(
    sql`select id from ${sql.identifier(table)} where outbox_needed = false`,
  );
  for (const row of result.rows) {
    await writeAsync({ type: 'delete', key: row.id });
  }
  updateShape(table, { upToDate: false });
}

export function electricSync(table: SyncTable, params: SyncParams): Promise<() => void> {
  let ready = false;

  const stream = new ShapeStream<Record<string, unknown>>({
    url: `${config.API_URL}api/sync/shapes/${table}`,
    fetchClient: ((input, init) =>
      fetch(input, { ...init, credentials: 'include' })) as typeof fetch,
    liveSse: true,
    columnMapper: snakeCamelMapper(),
    parser: {
      timestamptz: (value: string) =>
        new Date(value.replace(' ', 'T').replace(/\+00$/, '+00:00')),
      int2: (value: string) => Number(value),
      int4: (value: string) => Number(value),
      int8: (value: string) => Number(value),
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Electric sync failed.';
      updateShape(table, { error: message, connected: false, upToDate: false });
      if (error instanceof FetchError && (error.status === 401 || error.status === 403)) {
        return;
      }
      return {};
    },
  });

  const unsubscribe = stream.subscribe(
    async (messages) => {
      for (const message of messages) {
        if (isControlMessage(message)) {
          if (message.headers.control === 'must-refetch') {
            await resetTable(table, params.writeAsync);
          }
          if (message.headers.control === 'up-to-date') {
            updateShape(table, {
              upToDate: true,
              connected: true,
              error: null,
            });
            if (!ready) {
              ready = true;
              params.markReady();
            }
          }
          continue;
        }

        if (!isChangeMessage(message)) {
          continue;
        }

        const value = (message.value ?? {}) as Record<string, unknown>;
        const rawKey = message.key ?? '';
        const key =
          typeof value.id === 'string'
            ? params.collection.getKeyFromItem(value)
            : (rawKey.split('/').pop() ?? rawKey).replaceAll('"', '');
        if (pendingIds().has(key)) {
          continue;
        }

        if (message.headers.operation === 'delete') {
          await params.writeAsync({ type: 'delete', key });
        } else if (message.headers.operation === 'insert') {
          // A full snapshot on every app load re-sends rows that are already in
          // PGlite. Upsert those instead of failing on the primary key.
          await params.writeAsync({
            type: (await rowExists(table, key)) ? 'update' : 'insert',
            value,
          });
        } else {
          await params.writeAsync({ type: 'update', value });
        }
      }
      updateShape(table, { connected: true });
    },
    (error) => {
      updateShape(table, {
        error: error.message,
        connected: false,
        upToDate: false,
      });
    },
  );

  return Promise.resolve(() => {
    unsubscribe();
    stream.unsubscribeAll();
  });
}
