import { and, asc, eq, inArray, lte } from 'drizzle-orm';
import { createSignal } from 'solid-js';
import { v7 as uuidv7 } from 'uuid';
import {
  syncTables,
  type SyncMutation,
  type SyncMutationResult,
  type SyncTable,
} from '@lofipix/db/schema';
import { sendSyncMutations, SyncTransportError } from './api/sync';
import { getDb } from './db/client';
import { getCollection } from './db/registry';
import { localSyncTables, outbox, type OutboxRow } from './db/schema';
import { allShapesUpToDate, shapeError } from './sync-status';

const PENDING_STATUSES = ['pending', 'failed'] as const;
const MAX_ATTEMPTS = 10;

const [pendingIdsSignal, setPendingIds] = createSignal<ReadonlySet<string>>(new Set());
const [pendingCount, setPendingCount] = createSignal(0);
const [deadCount, setDeadCount] = createSignal(0);
const [outboxError, setOutboxError] = createSignal<string | null>(null);
const [uploading, setUploading] = createSignal(false);
const [online, setOnline] = createSignal(
  typeof navigator === 'undefined' ? true : navigator.onLine,
);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));
}

export const pendingIds = pendingIdsSignal;
export const pending = pendingCount;
export const dead = deadCount;
export const lastOutboxError = outboxError;
export const isUploading = uploading;
export const isOnline = online;

let flushQueue: Promise<unknown> = Promise.resolve();
let flushing = false;
let started = false;

function serialized<T>(work: () => Promise<T>): Promise<T> {
  const run = flushQueue.then(work, work);
  flushQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function tableFor(table: SyncTable): any {
  return localSyncTables[table];
}

function stripSystem(
  row: Record<string, unknown>,
  keepCreatedAt: boolean,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (
      key === 'id' ||
      key === 'organizationId' ||
      key === 'version' ||
      key === 'updatedAt' ||
      key === 'outboxNeeded' ||
      key === 'deletedAt' ||
      (!keepCreatedAt && key === 'createdAt')
    ) {
      continue;
    }
    payload[key] = value;
  }
  return payload;
}

function insertPayload(table: SyncTable, row: Record<string, unknown>): Record<string, unknown> {
  void table;
  return stripSystem(row, true);
}

function updatePayload(
  table: SyncTable,
  changes: Record<string, unknown>,
): Record<string, unknown> {
  if (table === 'albums') {
    const payload: Record<string, unknown> = {};
    if ('name' in changes) payload.name = changes.name;
    if ('notes' in changes) payload.notes = changes.notes;
    return payload;
  }
  if (table === 'photos') {
    const payload: Record<string, unknown> = {};
    for (const key of [
      'position',
      'imageWidth',
      'imageHeight',
      'imageQuality',
      'imageSize',
      'imageChecksum',
    ]) {
      if (key in changes) payload[key] = changes[key];
    }
    return payload;
  }
  if (table === 'photo_locations') {
    return 'objectKey' in changes ? { objectKey: changes.objectKey } : {};
  }
  const payload: Record<string, unknown> = {};
  for (const key of ['providerType', 'label', 'externalId', 'config']) {
    if (key in changes) payload[key] = changes[key];
  }
  return payload;
}

function fullUpdatePayload(
  table: SyncTable,
  row: Record<string, unknown>,
): Record<string, unknown> {
  if (table === 'albums') {
    return { name: row.name, notes: row.notes };
  }
  if (table === 'photos') {
    return {
      position: row.position,
      imageWidth: row.imageWidth,
      imageHeight: row.imageHeight,
      imageQuality: row.imageQuality,
      imageSize: row.imageSize,
      imageChecksum: row.imageChecksum,
    };
  }
  if (table === 'photo_locations') {
    return { objectKey: row.objectKey };
  }
  return {
    providerType: row.providerType,
    label: row.label,
    externalId: row.externalId,
    config: row.config,
  };
}

async function readLocalRow(
  table: SyncTable,
  recordId: string,
): Promise<Record<string, unknown> | undefined> {
  const localTable = tableFor(table);
  const [row] = await getDb()
    .select()
    .from(localTable)
    .where(eq(localTable.id, recordId))
    .limit(1);
  return row as Record<string, unknown> | undefined;
}

async function markRecordClean(table: SyncTable, recordId: string): Promise<void> {
  const collection = getCollection(table);
  if (collection?.get(recordId)) {
    const transaction = collection.update(recordId, (draft) => {
      draft.outboxNeeded = false;
    });
    await transaction.when('settled');
    return;
  }
  const localTable = tableFor(table);
  await getDb()
    .update(localTable)
    .set({ outboxNeeded: false })
    .where(eq(localTable.id, recordId));
}

async function enqueue(
  table: SyncTable,
  operation: 'insert' | 'update' | 'delete',
  recordId: string,
  organizationId: string,
  payload: Record<string, unknown>,
  baseVersion: number,
): Promise<void> {
  const db = getDb();
  const now = new Date();
  const existing = await db
    .select()
    .from(outbox)
    .where(
      and(
        eq(outbox.recordId, recordId),
        inArray(outbox.status, [...PENDING_STATUSES]),
      ),
    )
    .orderBy(asc(outbox.createdAt));

  const insert = existing.find((row) => row.operation === 'insert');
  const update = existing.find((row) => row.operation === 'update');
  const remove = existing.find((row) => row.operation === 'delete');

  if (operation === 'insert') {
    if (insert) {
      await db
        .update(outbox)
        .set({ payload: { ...(insert.payload as Record<string, unknown>), ...payload }, updatedAt: now })
        .where(eq(outbox.id, insert.id));
    } else {
      await db.insert(outbox).values({
        id: uuidv7(),
        organizationId,
        tableName: table,
        recordId,
        operation,
        payload,
        baseVersion: 0,
        status: 'pending',
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  } else if (operation === 'update') {
    if (insert) {
      await db
        .update(outbox)
        .set({ payload: { ...(insert.payload as Record<string, unknown>), ...payload }, updatedAt: now })
        .where(eq(outbox.id, insert.id));
    } else if (update) {
      await db
        .update(outbox)
        .set({ payload: { ...(update.payload as Record<string, unknown>), ...payload }, updatedAt: now })
        .where(eq(outbox.id, update.id));
    } else {
      await db.insert(outbox).values({
        id: uuidv7(),
        organizationId,
        tableName: table,
        recordId,
        operation,
        payload,
        baseVersion,
        status: 'pending',
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  } else if (insert) {
    await db
      .delete(outbox)
      .where(
        and(
          eq(outbox.recordId, recordId),
          inArray(outbox.status, [...PENDING_STATUSES]),
        ),
      );
  } else if (update) {
    await db
      .update(outbox)
      .set({ operation: 'delete', payload: {}, updatedAt: now })
      .where(eq(outbox.id, update.id));
  } else if (remove) {
    await db
      .update(outbox)
      .set({ payload: {}, updatedAt: now })
      .where(eq(outbox.id, remove.id));
  } else {
    await db.insert(outbox).values({
      id: uuidv7(),
      organizationId,
      tableName: table,
      recordId,
      operation,
      payload: {},
      baseVersion,
      status: 'pending',
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  await markRecordClean(table, recordId);
  await refreshOutboxStatus();
  void flushOutbox();
}

export function queueInsert(
  table: SyncTable,
  row: Record<string, unknown>,
): void {
  if (row.outboxNeeded !== true) {
    return;
  }
  const recordId = String(row.id);
  const organizationId = String(row.organizationId);
  const payload = insertPayload(table, row);
  markPendingRecord(recordId);
  void serialized(() =>
    enqueue(table, 'insert', recordId, organizationId, payload, 0),
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
  const organizationId = String(original.organizationId);
  const baseVersion = Number(original.version ?? 0);
  const deleted = original.deletedAt == null && changes.deletedAt != null;
  const operation = deleted ? 'delete' : 'update';
  const payload = deleted
    ? {}
    : updatePayload(table, changes);
  markPendingRecord(recordId);
  void serialized(() =>
    enqueue(
      table,
      operation,
      recordId,
      organizationId,
      payload,
      baseVersion,
    ),
  ).catch(reportOutboxFailure);
}

export function queueDelete(
  table: SyncTable,
  row: Record<string, unknown>,
): void {
  const recordId = String(row.id);
  const organizationId = String(row.organizationId);
  markPendingRecord(recordId);
  void serialized(() =>
    enqueue(table, 'delete', recordId, organizationId, {}, Number(row.version ?? 0)),
  ).catch(reportOutboxFailure);
}

function markPendingRecord(recordId: string): void {
  setPendingIds((current) => {
    if (current.has(recordId)) {
      return current;
    }
    const next = new Set(current);
    next.add(recordId);
    return next;
  });
}

function reportOutboxFailure(error: unknown): void {
  setOutboxError(
    error instanceof Error ? error.message : 'Could not queue the local change.',
  );
}

export async function refreshOutboxStatus(): Promise<void> {
  try {
    const rows = await getDb()
      .select({
        recordId: outbox.recordId,
        status: outbox.status,
      })
      .from(outbox);
    const ids = new Set<string>();
    let active = 0;
    let terminal = 0;
    for (const row of rows) {
      ids.add(row.recordId);
      if (row.status === 'dead') {
        terminal += 1;
      } else {
        active += 1;
      }
    }
    for (const table of syncTables) {
      const localTable = tableFor(table);
      const flagged = await getDb()
        .select({ id: localTable.id })
        .from(localTable)
        .where(eq(localTable.outboxNeeded, true));
      for (const row of flagged as Array<{ id: string }>) {
        ids.add(row.id);
      }
    }
    setPendingIds(ids);
    setPendingCount(active);
    setDeadCount(terminal);
  } catch {
    setPendingIds(new Set<string>());
    setPendingCount(0);
    setDeadCount(0);
  }
}

export function pendingTotal(): number {
  return pendingCount() + deadCount();
}

export function outboxReadyForUpdate(): boolean {
  return pendingCount() === 0;
}

export function canApplyUpdate(): boolean {
  return online() && outboxReadyForUpdate() && allShapesUpToDate();
}

export function syncLabel(): string {
  if (!online()) return 'Offline';
  if (isUploading()) return 'Uploading';
  if (outboxError()) return 'Sync error';
  if (pendingCount() > 0) return `${pendingCount()} queued`;
  const error = shapeError();
  if (error) return 'Sync error';
  if (allShapesUpToDate()) return 'Connected';
  return 'Syncing';
}

async function localVersion(table: SyncTable, recordId: string): Promise<number | null> {
  const row = await readLocalRow(table, recordId);
  return row ? Number(row.version ?? 0) : null;
}

async function failRows(rows: OutboxRow[], message: string, retryable: boolean): Promise<void> {
  const db = getDb();
  const now = new Date();
  for (const row of rows) {
    const attempts = row.attemptCount + 1;
    const dead = !retryable || attempts >= MAX_ATTEMPTS;
    const nextAttemptAt = new Date(
      now.getTime() +
        Math.min(300_000, 2 ** Math.min(attempts, 8) * 1_000) +
        Math.floor(Math.random() * 1_000),
    );
    await db
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
  setOutboxError(message);
}

function normalizeServerRow(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...row, outboxNeeded: false };
  for (const field of ['createdAt', 'updatedAt', 'deletedAt', 'capturedAt']) {
    if (typeof normalized[field] === 'string') {
      normalized[field] = new Date(normalized[field]);
    }
  }
  return normalized;
}

async function applyServerRow(
  table: SyncTable,
  row: Record<string, unknown>,
): Promise<void> {
  const normalized = normalizeServerRow(row);
  const recordId = String(normalized.id);
  const collection = getCollection(table);
  if (collection) {
    if (collection.get(recordId)) {
      const transaction = collection.update(recordId, (draft) => {
        Object.assign(draft, normalized);
      });
      await transaction.when('settled');
    } else {
      const transaction = collection.insert(normalized);
      await transaction.when('settled');
    }
    return;
  }
  const localTable = tableFor(table);
  await getDb()
    .insert(localTable)
    .values(normalized)
    .onConflictDoUpdate({ target: localTable.id, set: normalized });
}

async function applyServerFields(
  table: SyncTable,
  recordId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const normalized = normalizeServerRow({ ...fields, outboxNeeded: false });
  const collection = getCollection(table);
  if (collection?.get(recordId)) {
    const transaction = collection.update(recordId, (draft) => {
      Object.assign(draft, normalized);
    });
    await transaction.when('settled');
    return;
  }
  const localTable = tableFor(table);
  await getDb()
    .update(localTable)
    .set(normalized)
    .where(eq(localTable.id, recordId));
}

async function retargetPending(
  recordId: string,
  version: number,
): Promise<void> {
  await getDb()
    .update(outbox)
    .set({ baseVersion: version, updatedAt: new Date() })
    .where(
      and(
        eq(outbox.recordId, recordId),
        inArray(outbox.status, [...PENDING_STATUSES]),
      ),
    );
}

async function handleResult(row: OutboxRow, result: SyncMutationResult): Promise<void> {
  const table = row.tableName as SyncTable;
  const db = getDb();

  if (result.status === 'applied') {
    if (result.row) {
      await applyServerRow(table, result.row);
    } else if (result.version != null) {
      await applyServerFields(table, row.recordId, {
        version: result.version,
        updatedAt: new Date(),
      });
    }
    await db.delete(outbox).where(eq(outbox.id, row.id));
    if (result.version != null) {
      await retargetPending(row.recordId, result.version);
    }
    return;
  }

  if (result.status === 'duplicate') {
    if (result.version != null) {
      if (result.row) {
        await applyServerRow(table, result.row);
      }
      await db.delete(outbox).where(eq(outbox.id, row.id));
      await retargetPending(row.recordId, result.version);
      return;
    }
    await db
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
    if (result.row) {
      await applyServerRow(table, result.row);
    }
    await db.delete(outbox).where(eq(outbox.recordId, row.recordId));
    setOutboxError(
      result.error ?? 'This item changed on another device. The local change was discarded.',
    );
    return;
  }

  await db
    .update(outbox)
    .set({
      status: 'dead',
      lastError: result.error ?? 'The server rejected this change.',
      updatedAt: new Date(),
    })
    .where(eq(outbox.id, row.id));
  setOutboxError(result.error ?? 'The server rejected a local change.');
}

export async function flushOutbox(): Promise<void> {
  if (flushing || !online()) {
    return;
  }
  flushing = true;
  setUploading(true);
  try {
    const db = getDb();
    const now = new Date();
    const due = await db
      .select()
      .from(outbox)
      .where(
        and(
          inArray(outbox.status, [...PENDING_STATUSES]),
          lte(outbox.nextAttemptAt, now),
        ),
      )
      .orderBy(asc(outbox.createdAt));

    if (due.length === 0) {
      return;
    }

    const inflight = await db
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
          await db
            .update(outbox)
            .set({
              status: 'dead',
              lastError: 'The local row no longer exists.',
              updatedAt: new Date(),
            })
            .where(eq(outbox.id, row.id));
          continue;
        }
        baseVersion = version;
      }
      await db
        .update(outbox)
        .set({ baseVersion, updatedAt: new Date() })
        .where(eq(outbox.id, row.id));
      prepared.push({ ...row, baseVersion });
      mutations.push({
        mutationId: row.id,
        table: row.tableName as SyncTable,
        operation: row.operation as SyncMutation['operation'],
        recordId: row.recordId,
        baseVersion,
        payload: (row.payload as Record<string, unknown>) ?? {},
      });
    }

    if (mutations.length === 0) {
      return;
    }

    await db
      .update(outbox)
      .set({ status: 'inflight', updatedAt: new Date() })
      .where(inArray(outbox.id, prepared.map((row) => row.id)));

    let response;
    try {
      response = await sendSyncMutations(mutations);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not reach the sync API.';
      if (
        error instanceof SyncTransportError &&
        (error.status === 401 || error.status === 403)
      ) {
        await getDb()
          .update(outbox)
          .set({
            status: 'pending',
            nextAttemptAt: new Date(Date.now() + 30_000),
            lastError: message,
            updatedAt: new Date(),
          })
          .where(inArray(outbox.id, prepared.map((row) => row.id)));
        setOutboxError(message);
        return;
      }
      const retryable = error instanceof SyncTransportError ? error.retryable : true;
      await failRows(prepared, message, retryable);
      return;
    }

    const results = new Map(
      response.results.map((result) => [result.mutationId, result]),
    );
    for (const row of prepared) {
      const result = results.get(row.id);
      if (!result) {
        await failRows([row], 'The sync API returned no result.', true);
        continue;
      }
      await handleResult(row, result);
    }
    setOutboxError(null);
  } catch (error) {
    setOutboxError(
      error instanceof Error ? error.message : 'Sync failed unexpectedly.',
    );
  } finally {
    flushing = false;
    setUploading(false);
    await refreshOutboxStatus();
    if (getDb() && (await hasDue())) {
      setTimeout(() => void flushOutbox(), 1_000);
    }
  }
}

async function hasDue(): Promise<boolean> {
  try {
    const rows = await getDb()
      .select({ id: outbox.id })
      .from(outbox)
      .where(
        and(
          inArray(outbox.status, [...PENDING_STATUSES]),
          lte(outbox.nextAttemptAt, new Date()),
        ),
      )
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function reconcileOutbox(): Promise<void> {
  const db = getDb();
  const now = new Date();
  for (const table of syncTables) {
    const localTable = tableFor(table);
    const flagged = await db
      .select()
      .from(localTable)
      .where(eq(localTable.outboxNeeded, true));

    for (const row of flagged as Array<Record<string, unknown>>) {
      const recordId = String(row.id);
      const existing = await db
        .select({ id: outbox.id })
        .from(outbox)
        .where(eq(outbox.recordId, recordId))
        .limit(1);
      if (existing.length > 0) {
        await db
          .update(localTable)
          .set({ outboxNeeded: false })
          .where(eq(localTable.id, recordId));
        continue;
      }

      const version = Number(row.version ?? 0);
      const deleted = row.deletedAt != null;
      if (deleted && version === 0) {
        await db.delete(localTable).where(eq(localTable.id, recordId));
        continue;
      }

      const operation = deleted ? 'delete' : version === 0 ? 'insert' : 'update';
      const payload =
        operation === 'insert'
          ? insertPayload(table, row)
          : operation === 'update'
            ? fullUpdatePayload(table, row)
            : {};

      await db.insert(outbox).values({
        id: uuidv7(),
        organizationId: String(row.organizationId),
        tableName: table,
        recordId,
        operation,
        payload,
        baseVersion: version,
        status: 'pending',
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await db
        .update(localTable)
        .set({ outboxNeeded: false })
        .where(eq(localTable.id, recordId));
    }
  }
}

export async function startOutbox(): Promise<() => void> {
  if (started) {
    return () => {};
  }
  started = true;

  const db = getDb();
  await db
    .update(outbox)
    .set({
      status: 'pending',
      attemptCount: 0,
      nextAttemptAt: new Date(),
      updatedAt: new Date(),
    })
    .where(inArray(outbox.status, ['inflight', 'dead']));
  await reconcileOutbox();
  await refreshOutboxStatus();

  const online = () => {
    setOutboxError(null);
    void flushOutbox();
  };
  window.addEventListener('online', online);
  const timer = window.setInterval(() => void flushOutbox(), 15_000);
  void flushOutbox();

  return () => {
    started = false;
    window.removeEventListener('online', online);
    window.clearInterval(timer);
  };
}

export function resetOutboxState(): void {
  setPendingIds(new Set<string>());
  setPendingCount(0);
  setDeadCount(0);
  setOutboxError(null);
  setUploading(false);
  flushing = false;
}
