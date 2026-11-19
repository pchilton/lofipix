import type { SyncStatus } from "@powersync/web";
import { useEffect, useState } from "react";

import { useOnlineStatus } from "../use-online-status";
import { powersync } from "./powersync";

export type SyncPhase =
  | "loading"
  | "offline"
  | "connecting"
  | "syncing"
  | "synced"
  | "error";

export interface SyncState {
  phase: SyncPhase;
  message: string | null;
  lastSyncedAt: Date | null;
}

function deriveState(status: SyncStatus, online: boolean): SyncState {
  if (!online) {
    return {
      phase: "offline",
      message: null,
      lastSyncedAt: status.lastSyncedAt ?? null,
    };
  }
  const error = status.uploadError ?? status.downloadError;
  if (error) {
    return {
      phase: "error",
      message: error.message,
      lastSyncedAt: status.lastSyncedAt ?? null,
    };
  }
  if (status.connecting) {
    return {
      phase: "connecting",
      message: null,
      lastSyncedAt: status.lastSyncedAt ?? null,
    };
  }
  if (status.uploading || status.downloading) {
    return {
      phase: "syncing",
      message: null,
      lastSyncedAt: status.lastSyncedAt ?? null,
    };
  }
  if (!status.connected && !status.hasSynced) {
    return {
      phase: "connecting",
      message: null,
      lastSyncedAt: status.lastSyncedAt ?? null,
    };
  }
  if (status.hasSynced) {
    return {
      phase: "synced",
      message: null,
      lastSyncedAt: status.lastSyncedAt ?? null,
    };
  }
  return {
    phase: "loading",
    message: null,
    lastSyncedAt: status.lastSyncedAt ?? null,
  };
}

export function useSyncState(): SyncState {
  const online = useOnlineStatus();
  const [status, setStatus] = useState(() => powersync.currentStatus);

  useEffect(() => {
    const unsubscribe = powersync.registerListener({
      statusChanged: (next) => setStatus(next),
    });
    setStatus(powersync.currentStatus);
    return unsubscribe;
  }, []);

  return deriveState(status, online);
}
