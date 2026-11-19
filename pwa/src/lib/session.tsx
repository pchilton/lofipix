import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { authClient, describeAuthError } from "./auth-client";
import { clearLocalData, connectPowerSync, disconnectPowerSync } from "./db/sync";
import {
  clearCachedProfile,
  profileFromSession,
  readCachedProfile,
  saveCachedProfile,
  type SessionProfile,
} from "./session-profile";
import {
  clearSessionStale,
  markSessionStale,
  useSessionStale,
} from "./session-store";
import { useOnlineStatus } from "./use-online-status";

interface SessionContextValue {
  profile: SessionProfile | null;
  isAuthenticated: boolean;
  isPending: boolean;
  isStale: boolean;
  isOffline: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function authErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("status" in error)) {
    return null;
  }
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number") {
    return status;
  }
  if (typeof status === "string") {
    const parsed = Number(status);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { data, isPending, error } = authClient.useSession();
  const [profile, setProfile] = useState<SessionProfile | null>(() =>
    readCachedProfile(),
  );
  const stale = useSessionStale();
  const online = useOnlineStatus();

  useEffect(() => {
    if (!data?.user) {
      return;
    }
    const next = profileFromSession(data);
    setProfile(next);
    saveCachedProfile(next);
    clearSessionStale();
  }, [data]);

  useEffect(() => {
    const status = authErrorStatus(error);
    if (status === 401 || status === 403) {
      markSessionStale();
    }
  }, [error]);

  const isAuthenticated = Boolean(data?.user) || (Boolean(profile) && !stale);

  useEffect(() => {
    if (!isAuthenticated) {
      void disconnectPowerSync().catch(() => {
        // Nothing to disconnect when the database is already closed.
      });
      return;
    }
    if (!online) {
      return;
    }
    void connectPowerSync().catch(() => {
      // PowerSync retries on its own; the sync badge surfaces the error.
    });
  }, [isAuthenticated, online]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      throw new Error(describeAuthError(result.error, "Sign-in failed."));
    }

    const session = await authClient.getSession();
    if (session.error || !session.data?.user) {
      throw new Error(
        describeAuthError(session.error, "Could not load the signed-in session."),
      );
    }

    const next = profileFromSession(session.data);
    setProfile(next);
    saveCachedProfile(next);
    clearSessionStale();
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authClient.signOut();
    } catch {
      // Signing out while offline still clears local access.
    }
    clearCachedProfile();
    setProfile(null);
    clearSessionStale();
    try {
      await clearLocalData();
    } catch {
      // The local database may not have been opened yet.
    }
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      profile,
      isAuthenticated,
      isPending,
      isStale: stale,
      isOffline: !online,
      signIn,
      signOut,
    }),
    [profile, isAuthenticated, isPending, stale, online, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return context;
}
