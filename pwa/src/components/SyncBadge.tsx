import { Badge } from "@lofipix/ui";
import IconAlertTriangle from "~icons/lucide/triangle-alert";
import IconCheck from "~icons/lucide/check";
import IconCloudOff from "~icons/lucide/cloud-off";
import IconRefreshCw from "~icons/lucide/refresh-cw";

import { useSyncState } from "../lib/db/sync-state";

const labels = {
  loading: "Loading local data",
  offline: "Offline",
  connecting: "Connecting",
  syncing: "Syncing",
  synced: "Synced",
  error: "Sync error",
} as const;

export function SyncBadge() {
  const state = useSyncState();

  const icon =
    state.phase === "error" ? (
      <IconAlertTriangle aria-hidden="true" />
    ) : state.phase === "offline" ? (
      <IconCloudOff aria-hidden="true" />
    ) : state.phase === "synced" ? (
      <IconCheck aria-hidden="true" />
    ) : (
      <IconRefreshCw className="animate-spin" aria-hidden="true" />
    );

  return (
    <Badge
      variant={
        state.phase === "error"
          ? "destructive"
          : state.phase === "synced"
            ? "default"
            : "secondary"
      }
      title={state.message ?? undefined}
      aria-live="polite"
    >
      {icon}
      {labels[state.phase]}
    </Badge>
  );
}
