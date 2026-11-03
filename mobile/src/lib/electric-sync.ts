import {
  FetchError,
  ShapeStream,
  isChangeMessage,
  isControlMessage,
  snakeCamelMapper,
} from '@electric-sql/client';
import { getTableName } from 'drizzle-orm';
import type { SyncTable } from '@lofipix/db/schema';

import { authHeaders } from './api/sync';
import { config } from './config';
import { getClient } from './db/client';
import { outboxStore } from './outbox-store';
import { bumpRevision } from './revision';
import {
  deleteLocalRow,
  normalizeShapeRow,
  upsertLocalRow,
} from './row-mapping';
import { syncTableObjects } from './db/schema';
import { updateShape } from './sync-status';

const tables: SyncTable[] = ['albums', 'photos', 'photo_locations', 'storage_providers'];

function localTableName(table: SyncTable): string {
  return getTableName(syncTableObjects[table]);
}

async function resetTable(table: SyncTable): Promise<void> {
  const result = await getClient().execute(
    `select id from ${localTableName(table)} where outbox_needed = 0`,
  );
  for (const row of result.rows as Array<{ id: string }>) {
    await deleteLocalRow(table, row.id);
  }
  updateShape(table, { upToDate: false });
  bumpRevision();
}

function isPending(recordId: string): boolean {
  return outboxStore.get().pendingIds.has(recordId);
}

export function startShape(table: SyncTable): () => void {
  const stream = new ShapeStream<Record<string, unknown>>({
    url: `${config.API_URL}api/sync/shapes/${table}`,
    fetchClient: ((input, init) =>
      fetch(input, {
        ...init,
        headers: { ...(init?.headers as Record<string, string> | undefined), ...authHeaders() },
      })) as typeof fetch,
    liveSse: false,
    columnMapper: snakeCamelMapper(),
    parser: {
      timestamptz: (value: string) => value,
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
      try {
        for (const message of messages) {
          if (isControlMessage(message)) {
            if (message.headers.control === 'must-refetch') {
              await resetTable(table);
            }
            if (message.headers.control === 'up-to-date') {
              updateShape(table, { upToDate: true, connected: true, error: null });
              bumpRevision();
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
              ? value.id
              : (rawKey.split('/').pop() ?? rawKey).replaceAll('"', '');

          if (isPending(key)) {
            continue;
          }

          if (message.headers.operation === 'delete') {
            await deleteLocalRow(table, key);
          } else {
            await upsertLocalRow(table, normalizeShapeRow(value));
          }
          bumpRevision();
        }
        updateShape(table, { connected: true });
      } catch (error) {
        updateShape(table, {
          error: error instanceof Error ? error.message : 'Could not store shape data.',
          connected: false,
          upToDate: false,
        });
      }
    },
    (error) => {
      updateShape(table, { error: error.message, connected: false, upToDate: false });
    },
  );

  return () => {
    unsubscribe();
    stream.unsubscribeAll();
  };
}

export function startShapes(): () => void {
  const unsubscribes = tables.map((table) => startShape(table));
  return () => {
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
  };
}
