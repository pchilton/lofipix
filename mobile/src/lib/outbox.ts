import { and, asc, eq, inArray, lte } from 'drizzle-orm';
import NetInfo from '@react-native-community/netinfo';
import { v7 as uuidv7 } from 'uuid';
import {
  syncTables,
  type SyncMutation,
  type SyncMutationResult,
  type SyncTable,
} from '@lofipix/db/schema';

import { sendSyncMutations, SyncTransportError } from './api/sync';
import { getClient, getDb } from './db/client';
import { outbox, syncTableObjects, type OutboxRow, type OutboxStatus } from './db/schema';
import {
  coalesceOperation,
  findPendingForRecord,
  parsePayload,
  serializePayload,
  type OutboxOperation,
} from './outbox-helpers';
import {
  markRecordPending,
  outboxStore,
  pendingTotal as storePendingTotal,
  setOnline,
  setOutboxPatch,
} from './outbox-store';
import {
  allShapesUpToDate,
  shapeError,
} from './sync-status';
import { bumpRevision } from './revision';
import { markSessionStale } from './session-events';
import {
  deleteLocalRow,
  fullUpdatePayload,
  insertPayload,
  normalizeServerRow,
  updatePayload,
  upsertLocalRow,
} from './row-mapping';
import { getTableName } from 'drizzle-orm';

const MAX_ATTEMPTS = 10;
const PENDING_STATUSES: OutboxStatus[] = ['pending', 'failed'];

let flushQueue: Promise<unknown> = Promise.resolve();
let flushing = false;
let started = false;
let stopListeners: (() => void) | undefined;
let interval: ReturnType<typeof setInterval> | undefined;

function serialized<T>(work: () => Promise<T>): Promise<T> {
  const run = flushQueue.then(work, work);
  flushQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function localTableName(table: SyncTable): string {
  return getTableName(syncTableObjects[table]);
}

async function localVersion(table: SyncTable, recordId: string): Promise<number | null> {
  const result = await getClient().execute(
    `select version from ${localTableName(table)} where id = ? limit 1`,
    [recordId],
  );
  const row = result.rows[0] as { version?: number | string } | undefined;
  return row?.version != null ? Number(row.version) : null;
}

async function markRecordClean(table: SyncTable, recordId: string): Promise<void> {
  await getClient().execute(`update ${localTableName(table)} set outbox_needed = 0 where id = ?`, [
    recordId,
  ]);
}

async function insertOutboxRow(values: {
  organizationId: string;
  table: SyncTable;
  recordId: string;
  operation: OutboxOperation;
  payload: Record<string, unknown>;
  baseVersion: number;
  status?: OutboxStatus;
}): Promise<void> {
  const now = new Date();
  await getDb().insert(outbox).values({
    id: uuidv7(),
    organizationId: values.organizationId,
    tableName: values.table,
    recordId: values.recordId,
    operation: values.operation,
    payload: serializePayload(values.payload),
    baseVersion: values.baseVersion,
    status: values.status ?? 'pending',
    attemptCount: 0,
    nextAttemptAt: now,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  });
}

async function enqueue(
  table: SyncTable,
  operation: OutboxOperation,
  recordId: string,
  organizationId: string,
  payload: Record<string, unknown>,
  baseVersion: number,
): Promise<void> {
  const existing = await findPendingForRecord(recordId);
  const insert = existing.find((row) => row.operation === 'insert');
  const update = existing.find((row) => row.operation === 'update');
  const remove = existing.find((row) => row.operation === 'delete');
  const decision = coalesceOperation({ insert, update, delete: remove }, operation);
  const now = new Date();

  if (decision.kind === 'remove') {
    await getDb()
      .delete(outbox)
      .where(and(eq(outbox.recordId, recordId), inArray(outbox.status, PENDING_STATUSES)));
  } else if (decision.kind === 'update-existing') {
    const target = decision.target === 'insert' ? insert : decision.target === 'update' ? update : remove;
    if (target) {
      const merged =
        decision.payloadMerge && decision.target !== 'delete'
          ? { ...parsePayload(target.payload), ...payload }
          : {};
      await getDb()
        .update(outbox)
        .set({
          operation: decision.target === 'delete' ? 'delete' : target.operation,
          payload: serializePayload(merged),
          updatedAt: now,
        })
        .where(eq(outbox.id, target.id));
    }
  } else {
    await insertOutboxRow({
      organizationId,
      table,
      recordId,
      operation,
      payload,
      baseVersion,
    });
  }

  await markRecordClean(table, recordId);
  await refreshOutboxStatus();
  bumpRevision();
  void flushOutbox();
}

export function queueInsert(table: SyncTable, row: Record<string, unknown>): void {
  if (row.outboxNeeded !== true) {
    return;
  }
  const recordId = String(row.id);
  markRecordPending(recordId);
  void serialized(() =>
    enqueue(table, 'insert', recordId, String(row.organizationId), insertPayload(row), 0),
  ).catch(reportOutboxFailure);
}

export function queueUpdate(
  table: SyncTable,
  original: Record<string, unknown>,
  changes: Record<string, unknown>,
): void {
  if (changes.outboxNeeded !== true) {
    return;
  }
  const recordId = String(original.id);
  const baseVersion = Number(original.version ?? 0);
  const deleted = original.deletedAt == null && changes.deletedAt != null;
  markRecordPending(recordId);
  void serialized(() =>
    enqueue(
      table,
      deleted ? 'delete' : 'update',
      recordId,
      String(original.organizationId),
      deleted ? {} : updatePayload(table, changes),
      baseVersion,
    ),
  ).catch(reportOutboxFailure);
}

export function queueDelete(table: SyncTable, row: Record<string, unknown>): void {
  const recordId = String(row.id);
  markRecordPending(recordId);
  void serialized(() =>
    enqueue(table, 'delete', recordId, String(row.organizationId), {}, Number(row.version ?? 0)),
  ).catch(reportOutboxFailure);
}

function reportOutboxFailure(error: unknown): void {
  setOutboxPatch({
    error: error instanceof Error ? error.message : 'Could not queue the local change.',
  });
}

export async function refreshOutboxStatus(): Promise<void> {
  try {
    const rows = await getDb()
      .select({ recordId: outbox.recordId, status: outbox.status })
      .from(outbox);
    const pendingIds = new Set<string>();
    let pendingCount = 0;
    let deadCount = 0;
    for (const row of rows) {
      pendingIds.add(row.recordId);
      if (row.status === 'dead') {
        deadCount += 1;
      } else {
        pendingCount += 1;
      }
    }
    for (const table of syncTables) {
      const localTable = syncTableObjects[table];
      const flagged = await getDb()
        .select({ id: localTable.id })
        .from(localTable)
        .where(eq(localTable.outboxNeeded, true));
      for (const row of flagged) {
        pendingIds.add(row.id);
      }
    }
    setOutboxPatch({ pendingIds, pendingCount, deadCount });
  } catch {
    setOutboxPatch({ pendingIds: new Set(), pendingCount: 0, deadCount: 0 });
  }
}

export function outboxReadyForUpdate(): boolean {
  return outboxStore.get().pendingCount === 0;
}

export function canApplyUpdate(): boolean {
  const state = outboxStore.get();
  return state.online && outboxReadyForUpdate() && allShapesUpToDate();
}

export function syncLabel(): string {
  const state = outboxStore.get();
  if (!state.online) return 'Offline';
  if (state.uploading) return 'Uploading';
  if (state.error) return 'Sync error';
  if (state.pendingCount > 0) return `${state.pendingCount} queued`;
  const error = shapeError();
  if (error) return 'Sync error';
  if (allShapesUpToDate()) return 'Connected';
  return 'Syncing';
}

async function failRows(rows: OutboxRow[], message: string, retryable: boolean): Promise<void> {
  const now = new Date();
  for (const row of rows) {
    const attempts = row.attemptCount + 1;
    const dead = !retryable || attempts >= MAX_ATTEMPTS;
    const nextAttemptAt = new Date(
      now.getTime() + Math.min(300_000, 2 ** Math.min(attempts, 8) * 1_000) + Math.floor(Math.random() * 1_000),
    );
    await getDb()
      .update(outbox)
      .set({
        status: dead ? 'dead' : 'failed',
        attemptCount: attempts,
        nextAttemptAt,
        lastError: message,
        updatedAt: now,
      })
      .where(eq(outbox.id, row.id));
  }
  setOutboxPatch({ error: message });
}

async function applyServerRow(table: SyncTable, row: Record<string, unknown>): Promise<void> {
  await upsertLocalRow(table, normalizeServerRow(row));
}

async function retargetPending(recordId: string, version: number): Promise<void> {
  await getDb()
    .update(outbox)
    .set({ baseVersion: version, updatedAt: new Date() })
    .where(and(eq(outbox.recordId, recordId), inArray(outbox.status, PENDING_STATUSES)));
}

function resultVersion(result: SyncMutationResult): number | null {
  const version = result.record?.version;
  return typeof version === 'number' && Number.isFinite(version) ? version : null;
}

async function handleResult(row: OutboxRow, result: SyncMutationResult): Promise<void> {
  const table = row.tableName as SyncTable;
  const version = resultVersion(result);

  if (result.status === 'applied') {
    if (result.record) {
      await applyServerRow(table, result.record);
    }
    await getDb().delete(outbox).where(eq(outbox.id, row.id));
    if (version != null) {
      await retargetPending(row.recordId, version);
    }
    bumpRevision();
    return;
  }

  if (result.status === 'duplicate') {
    if (result.record) {
      await applyServerRow(table, result.record);
    }
    if (version != null) {
      await getDb().delete(outbox).where(eq(outbox.id, row.id));
      await retargetPending(row.recordId, version);
      bumpRevision();
      return;
    }
    await getDb()
      .update(outbox)
      .set({
        status: 'failed',
        nextAttemptAt: new Date(Date.now() + 5_000),
        lastError: result.error ?? 'The mutation is still being processed.',
        updatedAt: new Date(),
      })
      .where(eq(outbox.id, row.id));
    return;
  }

  if (result.status === 'conflict') {
    if (result.record) {
      await applyServerRow(table, result.record);
    }
    await getDb().delete(outbox).where(eq(outbox.recordId, row.recordId));
    await markRecordClean(table, row.recordId);
    setOutboxPatch({
      error: result.error ?? 'This item changed on another device. The local change was discarded.',
    });
    bumpRevision();
    return;
  }

  await getDb()
    .update(outbox)
    .set({
      status: 'dead',
      lastError: result.error ?? 'The server rejected this change.',
      updatedAt: new Date(),
    })
    .where(eq(outbox.id, row.id));
  setOutboxPatch({ error: result.error ?? 'The server rejected a local change.' });
}

export async function flushOutbox(): Promise<void> {
  if (flushing || !outboxStore.get().online) {
    return;
  }
  flushing = true;
  setOutboxPatch({ uploading: true });
  try {
    const now = new Date();
    const due = await getDb()
      .select()
      .from(outbox)
      .where(and(inArray(outbox.status, PENDING_STATUSES), lte(outbox.nextAttemptAt, now)))
      .orderBy(asc(outbox.createdAt));

    if (due.length === 0) {
      return;
    }

    const inflight = await getDb()
      .select({ recordId: outbox.recordId })
      .from(outbox)
      .where(eq(outbox.status, 'inflight'));
    const blocked = new Set(inflight.map((row) => row.recordId));

    const selected: OutboxRow[] = [];
    const seen = new Set<string>();
    for (const row of due) {
      if (blocked.has(row.recordId) || seen.has(row.recordId)) {
        continue;
      }
      seen.add(row.recordId);
      selected.push(row);
      if (selected.length >= 100) {
        break;
      }
    }
    if (selected.length === 0) {
      return;
    }

    const mutations: SyncMutation[] = [];
    const prepared: OutboxRow[] = [];
    for (const row of selected) {
      let baseVersion = 0;
      if (row.operation !== 'insert') {
        const version = await localVersion(row.tableName as SyncTable, row.recordId);
        if (version === null) {
          await getDb()
            .update(outbox)
            .set({ status: 'dead', lastError: 'The local row no longer exists.', updatedAt: new Date() })
            .where(eq(outbox.id, row.id));
          continue;
        }
        baseVersion = version;
      }
      await getDb().update(outbox).set({ baseVersion, updatedAt: new Date() }).where(eq(outbox.id, row.id));
      prepared.push({ ...row, baseVersion });
      mutations.push({
        mutationId: row.id,
        tableName: row.tableName as SyncTable,
        operation: row.operation as SyncMutation['operation'],
        tableId: row.recordId,
        baseVersion,
        payload: parsePayload(row.payload),
      });
    }

    if (mutations.length === 0) {
      return;
    }

    await getDb()
      .update(outbox)
      .set({ status: 'inflight', updatedAt: new Date() })
      .where(inArray(outbox.id, prepared.map((row) => row.id)));

    let response;
    try {
      response = await sendSyncMutations(mutations);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not reach the sync API.';
      if (error instanceof SyncTransportError && (error.status === 401 || error.status === 403)) {
        await getDb()
          .update(outbox)
          .set({
            status: 'pending',
            nextAttemptAt: new Date(Date.now() + 30_000),
            lastError: message,
            updatedAt: new Date(),
          })
          .where(inArray(outbox.id, prepared.map((row) => row.id)));
        setOutboxPatch({ error: 'Your session expired. Sign in again to resume syncing.' });
        markSessionStale();
        return;
      }
      const retryable = error instanceof SyncTransportError ? error.retryable : true;
      await failRows(prepared, message, retryable);
      return;
    }

    const results = new Map(response.results.map((result) => [result.mutationId, result]));
    for (const row of prepared) {
      const result = results.get(row.id);
      if (!result) {
        await failRows([row], 'The sync API returned no result.', true);
        continue;
      }
      await handleResult(row, result);
    }
    setOutboxPatch({ error: null });
  } catch (error) {
    setOutboxPatch({ error: error instanceof Error ? error.message : 'Sync failed unexpectedly.' });
  } finally {
    flushing = false;
    setOutboxPatch({ uploading: false });
    await refreshOutboxStatus();
    if (await hasDue()) {
      setTimeout(() => void flushOutbox(), 1_000);
    }
  }
}

async function hasDue(): Promise<boolean> {
  try {
    const rows = await getDb()
      .select({ id: outbox.id })
      .from(outbox)
      .where(and(inArray(outbox.status, PENDING_STATUSES), lte(outbox.nextAttemptAt, new Date())))
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function reconcileOutbox(): Promise<void> {
  for (const table of syncTables) {
    const localTable = syncTableObjects[table];
    const flagged = await getDb()
      .select()
      .from(localTable)
      .where(eq(localTable.outboxNeeded, true));

    for (const row of flagged) {
      const recordId = String(row.id);
      const existing = await getDb()
        .select({ id: outbox.id })
        .from(outbox)
        .where(eq(outbox.recordId, recordId))
        .limit(1);
      if (existing.length > 0) {
        await markRecordClean(table, recordId);
        continue;
      }

      const version = Number(row.version ?? 0);
      const deleted = row.deletedAt != null;
      if (deleted && version === 0) {
        await deleteLocalRow(table, recordId);
        continue;
      }

      const operation: OutboxOperation = deleted ? 'delete' : version === 0 ? 'insert' : 'update';
      const payload =
        operation === 'insert'
          ? insertPayload(row)
          : operation === 'update'
            ? fullUpdatePayload(table, row)
            : {};

      await insertOutboxRow({
        organizationId: String(row.organizationId),
        table,
        recordId,
        operation,
        payload,
        baseVersion: version,
        status: 'pending',
      });
      await markRecordClean(table, recordId);
    }
  }
  await refreshOutboxStatus();
}

export async function startOutbox(): Promise<() => void> {
  if (started) {
    return () => {};
  }
  started = true;

  await getDb()
    .update(outbox)
    .set({ status: 'pending', attemptCount: 0, nextAttemptAt: new Date(), updatedAt: new Date() })
    .where(inArray(outbox.status, ['inflight', 'dead']));
  await reconcileOutbox();
  await refreshOutboxStatus();

  const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false);
    if (state.isConnected !== false) {
      setOutboxPatch({ error: null });
      void flushOutbox();
    }
  });

  interval = setInterval(() => void flushOutbox(), 15_000);
  void flushOutbox();

  const cleanup = () => {
    started = false;
    unsubscribeNetInfo();
    if (interval) {
      clearInterval(interval);
      interval = undefined;
    }
  };
  stopListeners = cleanup;
  return cleanup;
}

export function stopOutbox(): void {
  stopListeners?.();
  stopListeners = undefined;
}

export function resetOutboxState(): void {
  stopOutbox();
  flushing = false;
  started = false;
  setOutboxPatch({
    pendingIds: new Set(),
    pendingCount: 0,
    deadCount: 0,
    error: null,
    uploading: false,
  });
}

export function pendingTotalNow(): number {
  return storePendingTotal(outboxStore.get());
}
