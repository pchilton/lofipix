import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@lofipix/db";
import {
  albumInsertSchema,
  albums,
  photoInsertSchema,
  photos,
  type NewAlbum,
  type NewPhoto,
  type SyncOperation,
} from "@lofipix/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class SyncForbiddenError extends Error {}


function parseDate(value: Date | string | undefined): Date {
  const date = value instanceof Date ? value : new Date(value ?? "");
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Invalid date value.");
  }
  return date;
}

function toCamelCase(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function toRow(data: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    row[toCamelCase(key)] = value;
  }
  return row;
}


function clientAlbumFields(data: Record<string, unknown>): Record<string, unknown> {
  const row = toRow(data);
  delete row.organizationId;
  return row;
}

function albumOwnedBy(organizationId: string): SQL {
  return sql`exists (select 1 from ${albums} where ${albums.id} = ${photos.albumId} and ${albums.organizationId} = ${organizationId})`;
}

async function applyAlbumOperation(
  tx: Transaction,
  organizationId: string,
  operation: SyncOperation,
): Promise<void> {
  const now = new Date();
  const owned = and(eq(albums.id, operation.id), eq(albums.organizationId, organizationId));
  const parseAlbum = (data: Record<string, unknown>): NewAlbum => {
    const row = albumInsertSchema.parse(data);
    return {
      ...row,
      createdAt: parseDate(row.createdAt),
      updatedAt: parseDate(row.updatedAt),
      deletedAt: row.deletedAt ? parseDate(row.deletedAt) : null,
    };
  };

  if (operation.op === "DELETE") {
    const updated = await tx
      .update(albums)
      .set({ deletedAt: now, updatedAt: now })
      .where(owned)
      .returning({ id: albums.id });
    if (updated.length === 0) {
      throw new SyncForbiddenError("Album does not belong to this organisation.");
    }
    return;
  }

  if (operation.op === "PATCH") {
    const changes = albumInsertSchema
      .partial()
      .omit({ id: true, organizationId: true })
      .parse(clientAlbumFields(operation.opData ?? {}));
    if (Object.keys(changes).length === 0) {
      return;
    }
    const updated = await tx.update(albums).set(changes).where(owned).returning({ id: albums.id });
    if (updated.length === 0) {
      throw new SyncForbiddenError("Album does not belong to this organisation.");
    }
    return;
  }

  const row = parseAlbum({
    ...clientAlbumFields(operation.opData ?? {}),
    id: operation.id,
    organizationId,
  });
  await tx
    .insert(albums)
    .values(row)
    .onConflictDoUpdate({
      target: albums.id,
      set: {
        name: row.name,
        notes: row.notes ?? null,
        deletedAt: row.deletedAt ?? null,
        updatedAt: row.updatedAt ?? now,
      },
      setWhere: eq(albums.organizationId, organizationId),
    });
}

async function applyPhotoOperation(
  tx: Transaction,
  organizationId: string,
  operation: SyncOperation,
): Promise<void> {
  const now = new Date();
  const owned = and(eq(photos.id, operation.id), albumOwnedBy(organizationId));
  const parsePhoto = (data: Record<string, unknown>): NewPhoto => {
    const row = photoInsertSchema.parse(data);
    return {
      ...row,
      capturedAt: parseDate(row.capturedAt),
      createdAt: parseDate(row.createdAt),
      updatedAt: parseDate(row.updatedAt),
      deletedAt: row.deletedAt ? parseDate(row.deletedAt) : null,
    };
  };

  if (operation.op === "DELETE") {
    const updated = await tx
      .update(photos)
      .set({ deletedAt: now, updatedAt: now })
      .where(owned)
      .returning({ id: photos.id });
    if (updated.length === 0) {
      throw new SyncForbiddenError("Photo does not belong to this organisation.");
    }
    return;
  }

  if (operation.op === "PATCH") {
    const changes = photoInsertSchema
      .partial()
      .omit({ id: true, albumId: true })
      .parse(Object.fromEntries(Object.entries(toRow(operation.opData ?? {})).filter(([key]) => key !== "albumId")));
    if (Object.keys(changes).length === 0) {
      return;
    }
    const updated = await tx.update(photos).set(changes).where(owned).returning({ id: photos.id });
    if (updated.length === 0) {
      throw new SyncForbiddenError("Photo does not belong to this organisation.");
    }
    return;
  }

  const row = parsePhoto({ ...toRow(operation.opData ?? {}), id: operation.id });
  const [album] = await tx
    .select({ id: albums.id })
    .from(albums)
    .where(and(eq(albums.id, row.albumId), eq(albums.organizationId, organizationId)))
    .limit(1);
  if (!album) {
    throw new SyncForbiddenError(`Album ${row.albumId} does not belong to this organisation.`);
  }

  await tx
    .insert(photos)
    .values(row)
    .onConflictDoUpdate({
      target: photos.id,
      set: {
        position: row.position,
        imageWidth: row.imageWidth,
        imageHeight: row.imageHeight,
        imageQuality: row.imageQuality,
        imageSize: row.imageSize,
        capturedAt: row.capturedAt,
        imageChecksum: row.imageChecksum ?? null,
        deletedAt: row.deletedAt ?? null,
        updatedAt: row.updatedAt ?? now,
      },
      setWhere: albumOwnedBy(organizationId),
    });
}

export async function applySyncOperations(
  organizationId: string,
  operations: SyncOperation[],
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const operation of operations) {
      if (operation.table === "albums") {
        await applyAlbumOperation(tx, organizationId, operation);
      } else {
        await applyPhotoOperation(tx, organizationId, operation);
      }
    }
  });
}
