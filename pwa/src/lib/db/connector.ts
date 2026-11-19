import {
  syncTableNames,
  syncUploadRequestSchema,
  syncUploadResponseSchema,
  type SyncTableName,
  type SyncUploadEntry,
} from "@lofipix/db/schema";
import {
  UpdateType,
  type CommonPowerSyncDatabase,
  type CrudEntry,
  type PowerSyncBackendConnector,
} from "@powersync/web";

import { pwaEnvironment } from "../../config/environment";
import { resolveApiUrl } from "../api";
import { markSessionStale } from "../session-store";
import {
  clearConflictVersions,
  conflictKey,
  mergeConflictVersions,
  resolveBaseVersion,
  toNumericVersion,
  type UploadOp,
} from "./connector-utils";

const syncTables = new Set<string>(syncTableNames);
const versionOverrides = new Map<string, number>();
const MAX_CONFLICT_RETRIES = 4;

export function isSyncTable(table: string): table is SyncTableName {
  return syncTables.has(table);
}

async function readLocalVersion(
  database: CommonPowerSyncDatabase,
  table: SyncTableName,
  id: string,
): Promise<number> {
  const row = await database.getOptional<{ version: number | null }>(
    `SELECT version FROM ${table} WHERE id = ?`,
    [id],
  );
  return toNumericVersion(row?.version) ?? 0;
}

async function toUploadEntry(
  database: CommonPowerSyncDatabase,
  clientId: string,
  entry: CrudEntry,
): Promise<SyncUploadEntry> {
  if (!isSyncTable(entry.table)) {
    throw new Error(`Unexpected table in upload queue: ${entry.table}`);
  }

  const needsLocalVersion =
    entry.op !== UpdateType.PUT &&
    toNumericVersion(entry.previousValues?.version) === null;
  const localVersion = needsLocalVersion
    ? await readLocalVersion(database, entry.table, entry.id)
    : 0;

  return {
    op: entry.op as UploadOp,
    table: entry.table,
    id: entry.id,
    opData: entry.opData ?? {},
    opId: entry.clientId,
    clientId,
    baseVersion: resolveBaseVersion(
      entry.op as UploadOp,
      entry.previousValues,
      localVersion,
      versionOverrides.get(conflictKey(entry.table, entry.id)),
    ),
  };
}

async function requestCredentials(): Promise<string | null> {
  const response = await fetch(resolveApiUrl("api/sync/token"), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 401 || response.status === 403) {
    markSessionStale();
    return null;
  }
  if (!response.ok) {
    throw new Error(`Sync token request failed: ${response.status}`);
  }

  const body: unknown = await response.json();
  if (
    !body ||
    typeof body !== "object" ||
    !("token" in body) ||
    typeof (body as { token?: unknown }).token !== "string"
  ) {
    throw new Error("Sync token response did not contain a token");
  }
  return (body as { token: string }).token;
}

async function uploadQueue(database: CommonPowerSyncDatabase): Promise<void> {
  const clientId = await database.getClientId();

  while (true) {
    const batch = await database.getCrudBatch(1);
    if (!batch) {
      return;
    }
    const entries = batch.crud;
    let settled = false;

    for (let attempt = 0; attempt < MAX_CONFLICT_RETRIES; attempt += 1) {
      const uploads: SyncUploadEntry[] = [];
      for (const entry of entries) {
        uploads.push(await toUploadEntry(database, clientId, entry));
      }

      const payload = syncUploadRequestSchema.parse({ uploads });
      const response = await fetch(resolveApiUrl("api/sync/upload"), {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401 || response.status === 403) {
        markSessionStale();
        throw new Error("Session expired while uploading changes");
      }

      const body: unknown = await response.json().catch(() => null);
      const parsed = syncUploadResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new Error(`Invalid sync upload response: ${response.status}`);
      }

      if (response.ok) {
        clearConflictVersions(
          versionOverrides,
          uploads.map((upload) => ({ table: upload.table, id: upload.id })),
        );
        await batch.complete();
        settled = true;
        break;
      }

      if (response.status === 409) {
        const rejected = parsed.data.results.find(
          (result) => result.status === "rejected",
        );
        if (rejected) {
          throw new Error(rejected.error ?? "Sync upload was rejected");
        }

        const conflicts = parsed.data.results.filter(
          (result) => result.status === "conflict" && result.record,
        );
        if (conflicts.length === 0) {
          throw new Error("Sync upload conflicted without a server row");
        }

        const next = mergeConflictVersions(
          versionOverrides,
          uploads.map((upload) => ({ table: upload.table, id: upload.id })),
          parsed.data.results,
        );
        versionOverrides.clear();
        for (const [key, value] of next) {
          versionOverrides.set(key, value);
        }
        continue;
      }

      throw new Error(`Sync upload failed: ${response.status}`);
    }

    if (!settled) {
      throw new Error("Sync upload kept conflicting with the server");
    }
  }
}

export const powerSyncConnector: PowerSyncBackendConnector = {
  async fetchCredentials() {
    const token = await requestCredentials();
    if (!token) {
      return null;
    }
    return {
      endpoint: pwaEnvironment.POWERSYNC_URL.replace(/\/+$/, ""),
      token,
    };
  },
  async uploadData(database) {
    await uploadQueue(database);
  },
};