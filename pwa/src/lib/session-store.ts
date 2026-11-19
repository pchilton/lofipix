import { useSyncExternalStore } from "react";

const STALE_KEY = "lofipix.pwa.session-stale";

const listeners = new Set<() => void>();

function readStale(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(STALE_KEY) === "1";
}

let stale = readStale();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function isSessionStale(): boolean {
  return stale;
}

export function markSessionStale(): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STALE_KEY, "1");
  }
  stale = true;
  emit();
}

export function clearSessionStale(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STALE_KEY);
  }
  stale = false;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSessionStale(): boolean {
  return useSyncExternalStore(subscribe, isSessionStale, () => false);
}
