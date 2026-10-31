import type { AbstractPowerSyncDatabase, PowerSyncBackendConnector } from '@powersync/web';
import { config } from '../config';
import { uploadSyncOperations, SyncUploadError } from '../api/sync';
import { refreshPendingIds, reportUploadError } from './status';
import { syncTables, type SyncOperation } from '@lofipix/db/schema';

function isSyncTable(table: string): table is (typeof syncTables)[number] {
  return (syncTables as readonly string[]).includes(table);
}

export const powerSyncConnector: PowerSyncBackendConnector = {
  async fetchCredentials() {
    const response = await fetch(`${config.API_URL}api/sync/token`, { credentials: 'include' });
    if (!response.ok) {
      throw new Error('Cannot obtain a PowerSync token: sign in again.');
    }
    const body = (await response.json()) as { token: string };
    return { endpoint: config.POWERSYNC_URL, token: body.token };
  },

  async uploadData(database: AbstractPowerSyncDatabase) {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) {
      return;
    }

    try {
      await uploadSyncOperations(
        transaction.crud.map((entry): SyncOperation => {
          if (!isSyncTable(entry.table)) {
            throw new SyncUploadError(`Unknown table in local queue: ${entry.table}`, 400, false);
          }
          return { op: entry.op, table: entry.table, id: entry.id, opData: entry.opData ?? null };
        }),
      );
    } catch (error) {
      reportUploadError(error instanceof Error ? error.message : 'Upload failed.');
      throw error;
    }

    reportUploadError(null);
    await transaction.complete();
    await refreshPendingIds();
  },
};
