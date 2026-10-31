import { createSignal } from 'solid-js';
import type { SyncStatus } from '@powersync/web';
import { powerSyncDatabase } from './database';

const [status, setStatus] = createSignal<SyncStatus | null>(null);
const [pendingRecordIds, setPendingRecordIds] = createSignal<ReadonlySet<string>>(new Set());
const [uploadError, setUploadError] = createSignal<string | null>(null);

export const syncStatus = status;
export const pendingIds = pendingRecordIds;
export const lastUploadError = uploadError;

export function reportUploadError(message: string | null): void {
  setUploadError(message);
}

export async function refreshPendingIds(): Promise<void> {
  try {
    const batch = await powerSyncDatabase.getCrudBatch(5000);
    setPendingRecordIds(new Set(batch?.crud.map((entry) => entry.id) ?? []));
  } catch {
    setPendingRecordIds(new Set<string>());
  }
}

export function startStatusTracking(): void {
  powerSyncDatabase.registerListener({
    statusChanged: (next) => {
      setStatus(next);
      void refreshPendingIds();
    },
  });
  void refreshPendingIds();
}
