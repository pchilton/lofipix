import { useSyncExternalStore } from 'react';

import { createStore } from './store';

const store = createStore(0);

export function bumpRevision(): void {
  store.set((value) => value + 1);
}

export function useRevision(): number {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
