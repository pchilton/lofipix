import { createStore } from './store';

export const sessionEvents = createStore({ stale: false });

export function markSessionStale(): void {
  sessionEvents.set((current) => (current.stale ? current : { ...current, stale: true }));
}

export function clearSessionStale(): void {
  sessionEvents.set((current) => (current.stale ? { ...current, stale: false } : current));
}
