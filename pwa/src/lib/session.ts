import { createSignal } from 'solid-js';
import { z } from 'zod';
import { authClient } from './auth-client';
import { powerSyncConnector } from './powersync/connector';
import { powerSyncDatabase } from './powersync/database';
import { startStatusTracking } from './powersync/status';
import { supportsPowerSyncContext } from './powersync/secure-context';

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

let statusTracking = false;
let connectedUserId: string | null = null;
let loading: Promise<AppSession | null> | undefined;

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
        await startSync(next.userId);
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
  if (!supportsPowerSyncContext()) {
    return;
  }
  if (!statusTracking) {
    startStatusTracking();
    statusTracking = true;
  }
  if (connectedUserId === userId) {
    return;
  }
  if (connectedUserId) {
    await powerSyncDatabase.disconnect();
  }
  const previous = localStorage.getItem(SYNC_USER_KEY);
  if (previous && previous !== userId) {
    await powerSyncDatabase.disconnectAndClear();
  }
  localStorage.setItem(SYNC_USER_KEY, userId);
  connectedUserId = userId;
  try {
    await powerSyncDatabase.connect(powerSyncConnector);
  } catch {
    connectedUserId = null;
  }
}

export async function signOut(): Promise<void> {
  try {
    await authClient.signOut();
  } finally {
    writeCache(null);
    localStorage.removeItem(SYNC_USER_KEY);
    connectedUserId = null;
    await powerSyncDatabase.disconnectAndClear();
    loading = undefined;
    setCurrentSession(null);
  }
}

export function signedIn(value: AppSession | null | undefined): value is AppSession {
  return value !== null && value !== undefined;
}
