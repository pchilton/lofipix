import {
  syncTableNames,
  syncUploadRequestSchema,
  syncUploadResponseSchema,
  type SyncTableName,
  type SyncUploadEntry,
  type SyncUploadResult,
} from "@lofipix/db/schema";
import {
  UpdateType,
  type CommonPowerSyncDatabase,
  type CrudEntry,
  type PowerSyncBackendConnector,
  type Transaction,
} from "@powersync/web";

import { pwaEnvironment } from "../../config/environment";
import { resolveApiUrl } from "../api";
import { markSessionStale } from "../session-store";
import {
  buildRebaseRows,
  resolveBaseVersion,
  toNumericVersion,
  type UploadOp,
} from "./connector-utils";

const syncTables = new Set<string>(syncTableNames);

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
    baseVersion: resolveBaseVersion(entry.op as UploadOp, entry.previousValues, localVersion),
  };
}

async function writeServerRow(
  tx: Transaction,
  table: SyncTableName,
  row: Record<string, unknown>,
): Promise<void> {
  const id = row.id;
  if (typeof id !== "string") {
    throw new Error(`Server row for ${table} is missing an id`);
  }

  const columns = Object.keys(row).filter((column) => column !== "id");
  if (columns.length === 0) {
    return;
  }

  const values = columns.map((column) => row[column]);
  const updated = await tx.execute<{ id: string }>(
    `UPDATE ${table} SET ${columns.map((column) => `${column} = ?`).join(", ")} WHERE id = ? RETURNING id`,
    [...values, id],
  );
  if (updated.array.length > 0) {
    return;
  }

  const insertColumns = ["id", ...columns];
  await tx.execute(
    `INSERT INTO ${table} (${insertColumns.join(", ")}) VALUES (${insertColumns.map(() => "?").join(", ")})`,
    [id, ...values],
  );
}

async function reapplyPending(
  tx: Transaction,
  table: SyncTableName,
  id: string,
  pendingRow: Record<string, unknown>,
): Promise<void> {
  const columns = Object.keys(pendingRow);
  if (columns.length === 0) {
    return;
  }
  await tx.execute(
    `UPDATE ${table} SET ${columns.map((column) => `${column} = ?`).join(", ")} WHERE id = ?`,
    [...columns.map((column) => pendingRow[column]), id],
  );
}

async function rebaseConflicts(
  database: CommonPowerSyncDatabase,
  entries: CrudEntry[],
  results: SyncUploadResult[],
): Promise<void> {
  const entriesByOpId = new Map(entries.map((entry) => [entry.clientId, entry]));
  const conflicts = results.filter(
    (result) => result.status === "conflict" && result.record,
  );
  if (conflicts.length === 0) {
    return;
  }

  await database.writeTransaction(async (tx) => {
    for (const result of conflicts) {
      const entry = entriesByOpId.get(result.opId);
      if (!entry || !result.record || !isSyncTable(entry.table)) {
        throw new Error(`Cannot rebase op ${result.opId}`);
      }
      const { serverRow, pendingRow } = buildRebaseRows(
        entry.table,
        result.record,
        entry.opData ?? {},
      );
      await writeServerRow(tx, entry.table, serverRow);
      await reapplyPending(tx, entry.table, entry.id, pendingRow);
    }
  });
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

async function uploadBatch(database: CommonPowerSyncDatabase): Promise<void> {
  const batch = await database.getCrudBatch(100);
  if (!batch) {
    return;
  }

  const clientId = await database.getClientId();
  const uploads: SyncUploadEntry[] = [];
  for (const entry of batch.crud) {
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
    await batch.complete();
    return;
  }

  if (response.status === 409) {
    const rejected = parsed.data.results.find(
      (result) => result.status === "rejected",
    );
    if (rejected) {
      throw new Error(rejected.error ?? "Sync upload was rejected");
    }
    await rebaseConflicts(database, batch.crud, parsed.data.results);
    await batch.complete();
    return;
  }

  throw new Error(`Sync upload failed: ${response.status}`);
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
    await uploadBatch(database);
  },
};
