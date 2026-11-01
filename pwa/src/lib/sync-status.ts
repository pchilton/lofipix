import { createSignal } from 'solid-js';
import { syncTables, type SyncTable } from '@lofipix/db/schema';

export interface ShapeState {
  upToDate: boolean;
  connected: boolean;
  error: string | null;
}

function initialState(): Record<SyncTable, ShapeState> {
  return Object.fromEntries(
    syncTables.map((table) => [
      table,
      { upToDate: false, connected: false, error: null },
    ]),
  ) as Record<SyncTable, ShapeState>;
}

const [shapeStates, setShapeStates] = createSignal(initialState());

export const shapes = shapeStates;

export function updateShape(
  table: SyncTable,
  patch: Partial<ShapeState>,
): void {
  setShapeStates((current) => ({
    ...current,
    [table]: { ...current[table], ...patch },
  }));
}

export function allShapesUpToDate(): boolean {
  return Object.values(shapeStates()).every((state) => state.upToDate);
}

export function shapeError(): string | null {
  for (const state of Object.values(shapeStates())) {
    if (state.error) {
      return state.error;
    }
  }
  return null;
}

export function resetShapes(): void {
  setShapeStates(initialState());
}
