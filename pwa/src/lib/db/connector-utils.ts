import {
  serverRowToLocal,
  syncTableColumnMap,
  type SyncTableName,
} from "@lofipix/db/schema";

export type UploadOp = "PUT" | "PATCH" | "DELETE";

export function toNumericVersion(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function resolveBaseVersion(
  op: UploadOp,
  previousValues: Record<string, unknown> | undefined,
  localVersion: number,
): number {
  if (op === "PUT") {
    return 0;
  }
  return toNumericVersion(previousValues?.version) ?? localVersion;
}

export interface RebaseRows {
  serverRow: Record<string, unknown>;
  pendingRow: Record<string, unknown>;
}

export function buildRebaseRows(
  table: SyncTableName,
  serverRecord: Record<string, unknown>,
  opData: Record<string, unknown>,
): RebaseRows {
  const serverRow = serverRowToLocal(table, serverRecord);
  delete serverRow.encrypted_data;

  const columns = new Set(Object.keys(syncTableColumnMap[table]));
  const pendingRow: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(opData)) {
    if (key !== "id" && key !== "version" && columns.has(key)) {
      pendingRow[key] = value;
    }
  }

  return { serverRow, pendingRow };
}
