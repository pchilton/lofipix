import {
  syncUploadResponseSchema,
  serverRowToLocal,
  type SyncTableName,
} from '@lofipix/db/models/sync-upload';
import type {
  AbstractPowerSyncDatabase,
  CrudTransaction,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from '@powersync/react-native';

import { getAuthToken } from '../auth-client';
import { config } from '../config';
import { markSessionStale } from '../session-events';

interface UploadRow {
  version?: number;
}

const SYSTEM_COLUMNS = new Set(['id', 'version', 'deleted_at', 'updated_at']);

async function apiFetch(path: string, init: RequestInit): Promise<Response> {
  const token = getAuthToken();
  if (!token) {
    markSessionStale();
    throw new Error('Not signed in.');
  }
  const response = await fetch(`${config.API_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  });
  if (response.status === 401 || response.status === 403) {
    markSessionStale();
  }
  return response;
}

export class LofipixConnector implements PowerSyncBackendConnector {
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const response = await apiFetch('api/sync/token', { method: 'POST' });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { token?: unknown };
    if (typeof body.token !== 'string') {
      throw new Error('The sync token response was invalid.');
    }
    return {
      endpoint: `${config.API_URL}powersync/`,
      token: body.token,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) {
      return;
    }

    const uploads = await Promise.all(
      transaction.crud.map(async (entry) => {
        const row = await database.getOptional<UploadRow>(
          `select version from ${entry.table} where id = ?`,
          [entry.id],
        );
        return {
          op: entry.op,
          table: entry.table,
          id: entry.id,
          opData: entry.opData ?? {},
          opId: entry.clientId,
          clientId: String(entry.clientId),
          baseVersion: row?.version ?? 0,
        };
      }),
    );

    const response = await apiFetch('api/sync/upload', {
      method: 'POST',
      body: JSON.stringify({ uploads }),
    });
    if (!response.ok && response.status !== 409) {
      throw new Error(`Sync upload failed (${response.status}).`);
    }

    const parsed = syncUploadResponseSchema.parse(await response.json());
    await this.rebaseConflicts(database, transaction, parsed.results);
    await transaction.complete();
  }

  private async rebaseConflicts(
    database: AbstractPowerSyncDatabase,
    transaction: CrudTransaction,
    results: readonly { opId: number; status: string; record?: Record<string, unknown> }[],
  ): Promise<void> {
    const entries = new Map(transaction.crud.map((entry) => [entry.clientId, entry]));
    for (const result of results) {
      if (result.status !== 'conflict' || !result.record) {
        continue;
      }
      const entry = entries.get(result.opId);
      if (!entry) {
        continue;
      }
      const table = entry.table as SyncTableName;
      const local = serverRowToLocal(table, result.record);
      const values: Record<string, unknown> = { ...local };
      if (entry.op === 'DELETE') {
        const now = new Date().toISOString();
        values.deleted_at = now;
        values.updated_at = now;
      } else {
        for (const [key, value] of Object.entries(entry.opData ?? {})) {
          if (!SYSTEM_COLUMNS.has(key)) {
            values[key] = value;
          }
        }
        values.updated_at = new Date().toISOString();
      }
      delete values.id;
      const columns = Object.keys(values);
      if (columns.length === 0) {
        continue;
      }
      const assignments = columns.map((columnName) => `${columnName} = ?`).join(', ');
      const parameters = columns.map((columnName) => values[columnName]);
      await database.execute(
        `update ${table} set ${assignments} where id = ?`,
        [...parameters, entry.id],
      );
    }
  }
}
