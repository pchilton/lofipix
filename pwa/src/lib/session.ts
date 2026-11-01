import { createSignal } from 'solid-js';
import { z } from 'zod';
import { authClient } from './auth-client';
import { clearLocalDatabase } from './db/client';
import { initCollections, startCollectionSync } from './db/collections';
import {
  pendingTotal,
  resetOutboxState,
  startOutbox,
} from './outbox';

const CACHE_KEY = 'lofipix.session';
const SYNC_USER_KEY = 'lofipix.sync-user';

const appSessionSchema = z.object({
  userId: z.string(),
  email: z.string(),
  name: z.string(),
  organizationId: z.string().nullable(),
});

export type AppSession = z.infer<typeof appSessionSchema>;

const [currentSession, setCurrentSession] = createSignal<AppSession | null | undefined>(undefined);

export const session = currentSession;

let loading: Promise<AppSession | null> | undefined;
let syncStarted = false;

function readCache(): AppSession | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? appSessionSchema.parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(value: AppSession | null): void {
  if (value) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } else {
    localStorage.removeItem(CACHE_KEY);
  }
}

async function resolveSession(): Promise<AppSession | null> {
  if (!navigator.onLine) {
    return readCache();
  }
  try {
    const result = await authClient.getSession();
    if (result.error) {
      return readCache();
    }
    if (!result.data) {
      writeCache(null);
      return null;
    }
    const next: AppSession = {
      userId: result.data.user.id,
      email: result.data.user.email,
      name: result.data.user.name,
      organizationId: result.data.session.activeOrganizationId ?? null,
    };
    writeCache(next);
    return next;
  } catch {
    return readCache();
  }
}

export function loadSession(): Promise<AppSession | null> {
  if (!loading) {
    loading = resolveSession().then(async (next) => {
      setCurrentSession(next);
      if (next) {
        void startSync(next.userId).catch((error) => {
          console.error('Could not start sync:', error);
        });
      }
      return next;
    });
  }
  return loading;
}

export async function refreshSession(): Promise<AppSession | null> {
  loading = undefined;
  return loadSession();
}

export async function startSync(userId: string): Promise<void> {
  if (syncStarted) {
    return;
  }

  const previous = localStorage.getItem(SYNC_USER_KEY);
  if (previous && previous !== userId) {
    localStorage.setItem(SYNC_USER_KEY, userId);
    await clearLocalDatabase();
    resetOutboxState();
    window.location.reload();
    return;
  }
  localStorage.setItem(SYNC_USER_KEY, userId);
  syncStarted = true;

  initCollections();
  await startOutbox();
  await startCollectionSync();
}

export async function signOut(): Promise<void> {
  if (pendingTotal() > 0) {
    const proceed = window.confirm(
      'This device has changes that have not synced yet. Signing out will discard them. Continue?',
    );
    if (!proceed) {
      return;
    }
  }

  try {
    await authClient.signOut();
  } finally {
    writeCache(null);
    localStorage.removeItem(SYNC_USER_KEY);
    await clearLocalDatabase();
    resetOutboxState();
    setCurrentSession(null);
    window.location.reload();
  }
}

export function signedIn(value: AppSession | null | undefined): value is AppSession {
  return value !== null && value !== undefined;
}
