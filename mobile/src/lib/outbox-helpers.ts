import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from './db/client';
import { outbox, syncTableObjects, type OutboxRow, type OutboxStatus } from './db/schema';
import type { SyncTable } from '@lofipix/db/schema';

export const PENDING_STATUSES: OutboxStatus[] = ['pending', 'failed'];

export type OutboxOperation = 'insert' | 'update' | 'delete';

export interface OutboxDraft {
  table: SyncTable;
  recordId: string;
  operation: OutboxOperation;
  payload: Record<string, unknown>;
  baseVersion: number;
  status: OutboxStatus;
}

export interface CoalescedOutbox {
  insert?: OutboxRow;
  update?: OutboxRow;
  delete?: OutboxRow;
}

export function coalesceTargets(rows: OutboxRow[]): CoalescedOutbox {
  return {
    insert: rows.find((row) => row.operation === 'insert'),
    update: rows.find((row) => row.operation === 'update'),
    delete: rows.find((row) => row.operation === 'delete'),
  };
}

export function mergePayload(
  current: Record<string, unknown> | null,
  changes: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(current ?? {}), ...changes };
}

export function coalesceOperation(
  existing: CoalescedOutbox,
  operation: OutboxOperation,
): { kind: 'update-existing'; target: 'insert' | 'update' | 'delete'; payloadMerge: boolean } | { kind: 'create' } | { kind: 'remove'; target: 'insert' | 'update' | 'delete' } {
  if (operation === 'insert') {
    if (existing.insert) {
      return { kind: 'update-existing', target: 'insert', payloadMerge: true };
    }
    return { kind: 'create' };
  }

  if (operation === 'update') {
    if (existing.insert) {
      return { kind: 'update-existing', target: 'insert', payloadMerge: true };
    }
    if (existing.update) {
      return { kind: 'update-existing', target: 'update', payloadMerge: true };
    }
    return { kind: 'create' };
  }

  if (existing.insert) {
    return { kind: 'remove', target: 'insert' };
  }
  if (existing.update) {
    return { kind: 'update-existing', target: 'update', payloadMerge: false };
  }
  if (existing.delete) {
    return { kind: 'update-existing', target: 'delete', payloadMerge: false };
  }
  return { kind: 'create' };
}

export async function findPendingForRecord(recordId: string): Promise<OutboxRow[]> {
  return getDb()
    .select()
    .from(outbox)
    .where(and(eq(outbox.recordId, recordId), inArray(outbox.status, PENDING_STATUSES)));
}

export function localTableFor(table: SyncTable) {
  return syncTableObjects[table];
}

export function parsePayload(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function serializePayload(value: Record<string, unknown>): string {
  return JSON.stringify(value);
}
