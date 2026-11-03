import { useSyncExternalStore } from 'react';

import { syncTables, type SyncTable } from '@lofipix/db/schema';
import { createStore } from './store';

export interface ShapeState {
  upToDate: boolean;
  connected: boolean;
  error: string | null;
}

function initialState(): Record<SyncTable, ShapeState> {
  return Object.fromEntries(
    syncTables.map((table) => [table, { upToDate: false, connected: false, error: null }]),
  ) as Record<SyncTable, ShapeState>;
}

const store = createStore<Record<SyncTable, ShapeState>>(initialState());

export function updateShape(table: SyncTable, patch: Partial<ShapeState>): void {
  store.set((current) => ({
    ...current,
    [table]: { ...current[table], ...patch },
  }));
}

export function useShapeStates(): Record<SyncTable, ShapeState> {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function shapeSnapshot(): Record<SyncTable, ShapeState> {
  return store.get();
}

export function allShapesUpToDate(): boolean {
  return Object.values(store.get()).every((state) => state.upToDate);
}

export function shapeError(): string | null {
  for (const state of Object.values(store.get())) {
    if (state.error) {
      return state.error;
    }
  }
  return null;
}

export function resetShapes(): void {
  store.set(initialState());
}
