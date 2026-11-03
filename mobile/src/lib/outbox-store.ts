import { useSyncExternalStore } from 'react';

import { createStore } from './store';

export interface OutboxState {
  pendingIds: ReadonlySet<string>;
  pendingCount: number;
  deadCount: number;
  error: string | null;
  uploading: boolean;
  online: boolean;
}

const store = createStore<OutboxState>({
  pendingIds: new Set(),
  pendingCount: 0,
  deadCount: 0,
  error: null,
  uploading: false,
  online: true,
});

export const outboxStore = store;

export function setOnline(online: boolean): void {
  store.set((current) => ({ ...current, online }));
}

export function setOutboxPatch(patch: Partial<OutboxState>): void {
  store.set((current) => ({ ...current, ...patch }));
}

export function markRecordPending(recordId: string): void {
  store.set((current) => {
    if (current.pendingIds.has(recordId)) {
      return current;
    }
    const pendingIds = new Set(current.pendingIds);
    pendingIds.add(recordId);
    return { ...current, pendingIds };
  });
}

export function useOutboxState(): OutboxState {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function pendingTotal(state: OutboxState): number {
  return state.pendingCount + state.deadCount;
}
