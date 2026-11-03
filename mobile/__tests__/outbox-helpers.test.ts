import { coalesceOperation, mergePayload, type CoalescedOutbox } from '../src/lib/outbox-helpers';
import type { OutboxRow } from '../src/lib/db/schema';

function row(operation: 'insert' | 'update' | 'delete', payload: Record<string, unknown> = {}) {
  return {
    id: `${operation}-id`,
    operation,
    payload: JSON.stringify(payload),
  } as OutboxRow;
}

function existing(values: Partial<CoalescedOutbox>): CoalescedOutbox {
  return values;
}

describe('outbox coalescing', () => {
  it('turns an update into the existing insert payload', () => {
    const decision = coalesceOperation(existing({ insert: row('insert', { name: 'Old' }) }), 'update');
    expect(decision).toEqual({ kind: 'update-existing', target: 'insert', payloadMerge: true });
    expect(mergePayload({ name: 'Old' }, { name: 'New' })).toEqual({ name: 'New' });
  });

  it('creates a new mutation when nothing is pending', () => {
    expect(coalesceOperation(existing({}), 'update')).toEqual({ kind: 'create' });
    expect(coalesceOperation(existing({}), 'insert')).toEqual({ kind: 'create' });
    expect(coalesceOperation(existing({}), 'delete')).toEqual({ kind: 'create' });
  });

  it('drops an offline insert when it is deleted before syncing', () => {
    expect(coalesceOperation(existing({ insert: row('insert', { name: 'Temp' }) }), 'delete')).toEqual({
      kind: 'remove',
      target: 'insert',
    });
  });

  it('turns a synced update into a delete', () => {
    expect(coalesceOperation(existing({ update: row('update', { notes: 'x' }) }), 'delete')).toEqual({
      kind: 'update-existing',
      target: 'update',
      payloadMerge: false,
    });
  });

  it('keeps one delete when a delete is repeated', () => {
    expect(coalesceOperation(existing({ delete: row('delete') }), 'delete')).toEqual({
      kind: 'update-existing',
      target: 'delete',
      payloadMerge: false,
    });
  });

  it('keeps an existing insert for a repeated insert', () => {
    expect(coalesceOperation(existing({ insert: row('insert', { name: 'A' }) }), 'insert')).toEqual({
      kind: 'update-existing',
      target: 'insert',
      payloadMerge: true,
    });
  });
});
