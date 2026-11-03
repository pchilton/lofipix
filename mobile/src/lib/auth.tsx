import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Keychain from 'react-native-keychain';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { authClient, getAuthToken, setAuthToken } from './auth-client';
import { clearLocalDatabase, initLocalDatabase } from './db/client';
import { startShapes } from './electric-sync';
import { clearPhotoBytes } from './photo-capture';
import { refreshOutboxStatus, resetOutboxState, startOutbox, stopOutbox } from './outbox';
import { pendingTotal, outboxStore } from './outbox-store';
import { resetShapes } from './sync-status';
import { bumpRevision } from './revision';
import { clearSessionStale, sessionEvents } from './session-events';

const SESSION_CACHE_KEY = 'lofipix.session';
const SYNC_USER_KEY = 'lofipix.sync-user';
const KEYCHAIN_SERVICE = 'lofipix.session';

export interface AppSession {
  userId: string;
  email: string;
  name: string;
  organizationId: string | null;
}

interface AuthContextValue {
  status: 'loading' | 'signed-in' | 'signed-out';
  session: AppSession | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: (force?: boolean) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

let syncUserId: string | undefined;
let stopShapes: (() => void) | undefined;

async function storeToken(token: string): Promise<void> {
  setAuthToken(token);
  await Keychain.setGenericPassword('lofipix', token, { service: KEYCHAIN_SERVICE });
}

async function loadToken(): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
  if (!credentials) {
    return null;
  }
  setAuthToken(credentials.password);
  return credentials.password;
}

async function clearToken(): Promise<void> {
  setAuthToken(null);
  await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
}

async function readCache(): Promise<AppSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const value = JSON.parse(raw) as Partial<AppSession>;
    if (typeof value.userId !== 'string' || typeof value.email !== 'string') {
      return null;
    }
    return {
      userId: value.userId,
      email: value.email,
      name: typeof value.name === 'string' ? value.name : '',
      organizationId: typeof value.organizationId === 'string' ? value.organizationId : null,
    };
  } catch {
    return null;
  }
}

async function writeCache(value: AppSession | null): Promise<void> {
  if (value) {
    await AsyncStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(value));
  } else {
    await AsyncStorage.removeItem(SESSION_CACHE_KEY);
  }
}

async function resolveSession(): Promise<AppSession | null> {
  const result = await authClient.getSession();
  if (result.error || !result.data) {
    return null;
  }
  const session: AppSession = {
    userId: result.data.user.id,
    email: result.data.user.email,
    name: result.data.user.name,
    organizationId: result.data.session.activeOrganizationId ?? null,
  };
  await writeCache(session);
  return session;
}

async function clearLocalWork(): Promise<void> {
  stopShapes?.();
  stopShapes = undefined;
  stopOutbox();
  await clearLocalDatabase();
  await clearPhotoBytes();
  resetOutboxState();
  resetShapes();
  syncUserId = undefined;
}

async function startSync(session: AppSession): Promise<void> {
  if (syncUserId === session.userId) {
    return;
  }

  const previous = await AsyncStorage.getItem(SYNC_USER_KEY);
  if (previous && previous !== session.userId) {
    await clearLocalWork();
  }

  await AsyncStorage.setItem(SYNC_USER_KEY, session.userId);
  syncUserId = session.userId;

  await initLocalDatabase();
  await startOutbox();
  stopShapes = startShapes();
  await refreshOutboxStatus();
  bumpRevision();
}

function extractToken(result: unknown): string | null {
  const data = result as { data?: { token?: unknown } } | null;
  if (typeof data?.data?.token === 'string') {
    return data.data.token;
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const [session, setSession] = useState<AppSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    void (async () => {
      try {
        const cached = await readCache();
        const token = await loadToken();
        const online = (await NetInfo.fetch()).isConnected !== false;

        if (!token) {
          if (cached) {
            await startSync(cached);
          }
          if (!disposed) {
            setSession(cached);
            setStatus(cached ? 'signed-in' : 'signed-out');
          }
          return;
        }

        if (!online) {
          if (cached) {
            await startSync(cached);
          }
          if (!disposed) {
            setSession(cached);
            setStatus(cached ? 'signed-in' : 'signed-out');
          }
          return;
        }

        const resolved = await resolveSession();
        if (disposed) {
          return;
        }
        if (resolved) {
          await startSync(resolved);
          if (!disposed) {
            setSession(resolved);
            setStatus('signed-in');
          }
        } else {
          await clearToken();
          if (cached) {
            await startSync(cached);
          }
          if (!disposed) {
            setSession(cached);
            setStatus(cached ? 'signed-in' : 'signed-out');
          }
        }
      } catch (failure) {
        if (!disposed) {
          setError(failure instanceof Error ? failure.message : 'Could not restore the session.');
          setStatus('signed-out');
        }
      }
    })();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    return sessionEvents.subscribe(() => {
      if (!sessionEvents.get().stale) {
        return;
      }
      clearSessionStale();
      stopShapes?.();
      stopShapes = undefined;
      stopOutbox();
      syncUserId = undefined;
      void clearToken().finally(() => {
        setSession(null);
        setStatus('signed-out');
      });
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const online = (await NetInfo.fetch()).isConnected !== false;
    if (!online) {
      throw new Error('Connect to the internet to sign in.');
    }

    let capturedToken: string | null = null;
    const result = await authClient.signIn.email({
      email,
      password,
      fetchOptions: {
        onSuccess: (context) => {
          const header = context.response.headers.get('set-auth-token');
          if (header) {
            capturedToken = header;
          }
        },
      },
    });

    if (result.error) {
      throw new Error(result.error.message ?? 'Sign in failed.');
    }

    const token = capturedToken ?? extractToken(result) ?? getAuthToken();
    if (!token) {
      throw new Error('The sign-in response did not include a session token.');
    }
    await storeToken(token);
    const resolved = await resolveSession();
    if (!resolved) {
      throw new Error('The session could not be loaded.');
    }
    await startSync(resolved);
    setSession(resolved);
    setStatus('signed-in');
  }, []);

  const signOut = useCallback(async (force = false) => {
    if (!force && pendingTotal(outboxStore.get()) > 0) {
      return false;
    }
    try {
      await authClient.signOut();
    } finally {
      await clearToken();
      await writeCache(null);
      await AsyncStorage.removeItem(SYNC_USER_KEY);
      await clearLocalWork();
      setSession(null);
      setStatus('signed-out');
    }
    return true;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, error, signIn, signOut }),
    [status, session, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
}
