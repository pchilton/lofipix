import type { SyncTableName, SyncUploadResult } from "@lofipix/db/schema";

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

export function conflictKey(table: SyncTableName, id: string): string {
  return `${table}:${id}`;
}

export function resolveBaseVersion(
  op: UploadOp,
  previousValues: Record<string, unknown> | undefined,
  localVersion: number,
  overrideVersion?: number | null,
): number {
  if (op === "PUT") {
    return 0;
  }
  if (overrideVersion !== null && overrideVersion !== undefined) {
    return overrideVersion;
  }
  return toNumericVersion(previousValues?.version) ?? localVersion;
}

export interface PendingUploadRef {
  table: SyncTableName;
  id: string;
}

export function mergeConflictVersions(
  overrides: ReadonlyMap<string, number>,
  uploads: readonly PendingUploadRef[],
  results: readonly SyncUploadResult[],
): Map<string, number> {
  const next = new Map(overrides);
  const byOpId = new Map(uploads.map((upload, index) => [index, upload]));

  results.forEach((result, index) => {
    if (result.status !== "conflict" || !result.record) {
      return;
    }
    const upload = byOpId.get(index);
    const version = toNumericVersion(result.record.version);
    if (upload && version !== null) {
      next.set(conflictKey(upload.table, upload.id), version);
    }
  });

  return next;
}

export function clearConflictVersions(
  overrides: Map<string, number>,
  uploads: readonly PendingUploadRef[],
): void {
  for (const upload of uploads) {
    overrides.delete(conflictKey(upload.table, upload.id));
  }
}