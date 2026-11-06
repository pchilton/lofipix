import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@lofipix/db';
import {
  albumInsertSchema,
  albums,
  photoInsertSchema,
  photoLocationInsertSchema,
  photoLocations,
  photos,
  storageProviderInsertSchema,
  storageProviders,
  syncMutations,
  type SyncMutation,
  type SyncMutationResult,
  type SyncTable,
} from '@lofipix/db/schema';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Row = Record<string, unknown>;

export class SyncForbiddenError extends Error {}

const providerTypeSchema = z.enum(['opfs', 's3', 'onedrive', 'google_drive']);
const configSchema = z.record(z.string(), z.unknown());
const isoDate = z.string().datetime();

const albumCreatePayload = albumInsertSchema
  .omit({
    id: true,
    organizationId: true,
    version: true,
    deletedAt: true,
    updatedAt: true,
  })
  .strict();

const albumUpdatePayload = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();

const photoCreatePayload = photoInsertSchema
  .omit({
    id: true,
    organizationId: true,
    version: true,
    deletedAt: true,
    updatedAt: true,
  })
  .strict();

const photoUpdatePayload = photoCreatePayload
  .partial()
  .omit({ albumId: true, createdAt: true, originatedAt: true });

const photoLocationCreatePayload = photoLocationInsertSchema
  .extend({ createdAt: isoDate.optional() })
  .strict();

const photoLocationUpdatePayload = z
  .object({ objectKey: z.string().trim().min(1).optional() })
  .strict();

const storageProviderCreatePayload = storageProviderInsertSchema
  .omit({ organizationId: true, encryptedData: true })
  .extend({ createdAt: isoDate.optional() })
  .strict();

const storageProviderUpdatePayload = z
  .object({
    providerType: providerTypeSchema.optional(),
    label: z.string().trim().min(1).optional(),
    externalId: z.string().trim().min(1).optional(),
    config: configSchema.optional(),
  })
  .strict();

function normalizePayloadDates(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...payload };
  for (const field of ['createdAt', 'updatedAt', 'originatedAt', 'deletedAt']) {
    if (typeof next[field] === 'string') {
      next[field] = new Date(next[field] as string);
    }
  }
  return next;
}

function parseDate(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('Invalid date value.');
  }
  return date;
}

function publicRow(table: SyncTable, row: Row): Row {
  if (table !== 'storage_providers') {
    return row;
  }
  const { encryptedData: _encryptedData, ...safe } = row;
  return safe;
}

function applied(mutation: SyncMutation, row: Row): SyncMutationResult {
  return {
    mutationId: mutation.mutationId,
    status: 'applied',
    record: publicRow(mutation.tableName, row),
  };
}

function conflict(mutation: SyncMutation, row: Row): SyncMutationResult {
  return {
    mutationId: mutation.mutationId,
    status: 'conflict',
    record: publicRow(mutation.tableName, row),
  };
}

function rejected(mutation: SyncMutation, error: string): SyncMutationResult {
  return { mutationId: mutation.mutationId, status: 'rejected', error };
}

async function findRow(
  tx: Transaction,
  table: SyncTable,
  organizationId: string,
  id: string,
): Promise<Row | undefined> {
  switch (table) {
    case 'albums': {
      const [row] = await tx
        .select()
        .from(albums)
        .where(and(eq(albums.id, id), eq(albums.organizationId, organizationId)))
        .limit(1);
      return row;
    }
    case 'photos': {
      const [row] = await tx
        .select()
        .from(photos)
        .where(and(eq(photos.id, id), eq(photos.organizationId, organizationId)))
        .limit(1);
      return row;
    }
    case 'photo_locations': {
      const [row] = await tx
        .select()
        .from(photoLocations)
        .where(
          and(
            eq(photoLocations.id, id),
            eq(photoLocations.organizationId, organizationId),
          ),
        )
        .limit(1);
      return row;
    }
    case 'storage_providers': {
      const [row] = await tx
        .select()
        .from(storageProviders)
        .where(
          and(
            eq(storageProviders.id, id),
            eq(storageProviders.organizationId, organizationId),
          ),
        )
        .limit(1);
      return row;
    }
  }
}

async function requireAlbum(
  tx: Transaction,
  organizationId: string,
  albumId: string,
): Promise<void> {
  const [album] = await tx
    .select({ id: albums.id })
    .from(albums)
    .where(and(eq(albums.id, albumId), eq(albums.organizationId, organizationId)))
    .limit(1);
  if (!album) {
    throw new SyncForbiddenError(
      `Album ${albumId} does not belong to this organisation.`,
    );
  }
}

async function requirePhoto(
  tx: Transaction,
  organizationId: string,
  photoId: string,
): Promise<void> {
  const [photo] = await tx
    .select({ id: photos.id })
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.organizationId, organizationId)))
    .limit(1);
  if (!photo) {
    throw new SyncForbiddenError(
      `Photo ${photoId} does not belong to this organisation.`,
    );
  }
}

async function requireProvider(
  tx: Transaction,
  organizationId: string,
  providerId: string,
): Promise<void> {
  const [provider] = await tx
    .select({ id: storageProviders.id })
    .from(storageProviders)
    .where(
      and(
        eq(storageProviders.id, providerId),
        eq(storageProviders.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!provider) {
    throw new SyncForbiddenError(
      `Storage provider ${providerId} does not belong to this organisation.`,
    );
  }
}

async function applyInsert(
  tx: Transaction,
  organizationId: string,
  mutation: SyncMutation,
): Promise<SyncMutationResult> {
  const now = new Date();

  switch (mutation.tableName) {
    case 'albums': {
      const payload = albumCreatePayload.parse(normalizePayloadDates(mutation.payload));
      const [row] = await tx
        .insert(albums)
        .values({
          id: mutation.tableId,
          organizationId,
          name: payload.name,
          notes: payload.notes ?? null,
          version: 1,
          deletedAt: null,
          originatedAt: payload.originatedAt ? parseDate(payload.originatedAt) : now,
          createdAt: payload.createdAt ? parseDate(payload.createdAt) : now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning();
      if (row) {
        return applied(mutation, row);
      }
      const current = await findRow(tx, mutation.tableName, organizationId, mutation.tableId);
      return current ? conflict(mutation, current) : rejected(mutation, 'Album id is already in use.');
    }
    case 'photos': {
      const payload = photoCreatePayload.parse(normalizePayloadDates(mutation.payload));
      await requireAlbum(tx, organizationId, payload.albumId);
      const [row] = await tx
        .insert(photos)
        .values({
          id: mutation.tableId,
          organizationId,
          albumId: payload.albumId,
          position: payload.position,
          imageWidth: payload.imageWidth,
          imageHeight: payload.imageHeight,
          imageQuality: payload.imageQuality,
          imageSize: payload.imageSize,
          originatedAt: payload.originatedAt ? parseDate(payload.originatedAt) : now,
          imageChecksum: payload.imageChecksum ?? null,
          version: 1,
          deletedAt: null,
          createdAt: payload.createdAt ? parseDate(payload.createdAt) : now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning();
      if (row) {
        return applied(mutation, row);
      }
      const current = await findRow(tx, mutation.tableName, organizationId, mutation.tableId);
      return current ? conflict(mutation, current) : rejected(mutation, 'Photo id is already in use.');
    }
    case 'photo_locations': {
      const payload = photoLocationCreatePayload.parse(normalizePayloadDates(mutation.payload));
      await requirePhoto(tx, organizationId, payload.photoId);
      await requireProvider(tx, organizationId, payload.storageProviderId);
      const [row] = await tx
        .insert(photoLocations)
        .values({
          id: mutation.tableId,
          organizationId,
          photoId: payload.photoId,
          storageProviderId: payload.storageProviderId,
          objectKey: payload.objectKey,
          version: 1,
          deletedAt: null,
          originatedAt: payload.originatedAt ? parseDate(payload.originatedAt) : now,
          createdAt: payload.createdAt ? parseDate(payload.createdAt) : now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning();
      if (row) {
        return applied(mutation, row);
      }
      const current = await findRow(tx, mutation.tableName, organizationId, mutation.tableId);
      return current ? conflict(mutation, current) : rejected(mutation, 'Photo location id is already in use.');
    }
    case 'storage_providers': {
      const payload = storageProviderCreatePayload.parse(normalizePayloadDates(mutation.payload));
      const [row] = await tx
        .insert(storageProviders)
        .values({
          id: mutation.tableId,
          organizationId,
          providerType: payload.providerType,
          label: payload.label,
          externalId: payload.externalId,
          config: payload.config,
          encryptedData: {},
          version: 1,
          deletedAt: null,
          originatedAt: payload.originatedAt ? parseDate(payload.originatedAt) : now,
          createdAt: payload.createdAt ? parseDate(payload.createdAt) : now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning();
      if (row) {
        return applied(mutation, row);
      }
      const current = await findRow(tx, mutation.tableName, organizationId, mutation.tableId);
      return current ? conflict(mutation, current) : rejected(mutation, 'Storage provider id is already in use.');
    }
  }
}

async function applyUpdate(
  tx: Transaction,
  organizationId: string,
  mutation: SyncMutation,
): Promise<SyncMutationResult> {
  const now = new Date();

  switch (mutation.tableName) {
    case 'albums': {
      const changes = albumUpdatePayload.parse(mutation.payload);
      if (Object.keys(changes).length === 0) {
        const [row] = await tx
          .update(albums)
          .set({ version: sql`${albums.version} + 1`, updatedAt: now })
          .where(
            and(
              eq(albums.id, mutation.tableId),
              eq(albums.organizationId, organizationId),
              eq(albums.version, mutation.baseVersion),
            ),
          )
          .returning();
        if (row) {
          return applied(mutation, row);
        }
        const current = await findRow(tx, mutation.tableName, organizationId, mutation.tableId);
        return current ? conflict(mutation, current) : rejected(mutation, 'Album not found.');
      }
      const [row] = await tx
        .update(albums)
        .set({ ...changes, version: sql`${albums.version} + 1`, updatedAt: now })
        .where(
          and(
            eq(albums.id, mutation.tableId),
            eq(albums.organizationId, organizationId),
            eq(albums.version, mutation.baseVersion),
          ),
        )
        .returning();
      if (row) {
        return applied(mutation, row);
      }
      const current = await findRow(tx, mutation.tableName, organizationId, mutation.tableId);
      return current ? conflict(mutation, current) : rejected(mutation, 'Album not found.');
    }
    case 'photos': {
      const changes = photoUpdatePayload.parse(mutation.payload);
      if (Object.keys(changes).length === 0) {
        const [row] = await tx
          .update(photos)
          .set({ version: sql`${photos.version} + 1`, updatedAt: now })
          .where(
            and(
              eq(photos.id, mutation.tableId),
              eq(photos.organizationId, organizationId),
              eq(photos.version, mutation.baseVersion),
            ),
          )
          .returning();
        if (row) {
          return applied(mutation, row);
        }
        const current = await findRow(tx, mutation.tableName, organizationId, mutation.tableId);
        return current ? conflict(mutation, current) : rejected(mutation, 'Photo not found.');
      }
      const [row] = await tx
        .update(photos)
        .set({ ...changes, version: sql`${photos.version} + 1`, updatedAt: now })
        .where(
          and(
            eq(photos.id, mutation.tableId),
            eq(photos.organizationId, organizationId),
            eq(photos.version, mutation.baseVersion),
          ),
        )
        .returning();
      if (row) {
        return applied(mutation, row);
      }
      const current = await findRow(tx, mutation.tableName, organizationId, mutation.tableId);
      return current ? conflict(mutation, current) : rejected(mutation, 'Photo not found.');
    }
    case 'photo_locations': {
      const changes = photoLocationUpdatePayload.parse(mutation.payload);
      if (Object.keys(changes).length === 0) {
        const [row] = await tx
          .update(photoLocations)
          .set({ version: sql`${photoLocations.version} + 1`, updatedAt: now })
          .where(
            and(
              eq(photoLocations.id, mutation.tableId),
              eq(photoLocations.organizationId, organizationId),
              eq(photoLocations.version, mutation.baseVersion),
            ),
          )
          .returning();
        if (row) {
          return applied(mutation, row);
        }
        const current = await findRow(tx, mutation.tableName, organizationId, mutation.tableId);
        return current ? conflict(mutation, current) : rejected(mutation, 'Photo location not found.');
      }
      const [row] = await tx
        .update(photoLocations)
        .set({ ...changes, version: sql`${photoLocations.version} + 1`, updatedAt: now })
        .where(
          and(
            eq(photoLocations.id, mutation.tableId),
            eq(photoLocations.organizationId, organizationId),
            eq(photoLocations.version, mutation.baseVersion),
          ),
        )
        .returning();
      if (row) {
        return applied(mutation, row);
      }
      const current = await findRow(tx, mutation.tableName, organizationId, mutation.tableId);
      return current ? conflict(mutation, current) : rejected(mutation, 'Photo location not found.');
    }
    case 'storage_providers': {
      const changes = storageProviderUpdatePayload.parse(mutation.payload);
      if (Object.keys(changes).length === 0) {
        const [row] = await tx
          .update(storageProviders)
          .set({ version: sql`${storageProviders.version} + 1`, updatedAt: now })
          .where(
            and(
              eq(storageProviders.id, mutation.tableId),
              eq(storageProviders.organizationId, organizationId),
              eq(storageProviders.version, mutation.baseVersion),
            ),
          )
          .returning();
        if (row) {
          return applied(mutation, row);
        }
        const current = await findRow(tx, mutation.tableName, organizationId, mutation.tableId);
        return current ? conflict(mutation, current) : rejected(mutation, 'Storage provider not found.');
      }
      const [row] = await tx
        .update(storageProviders)
        .set({ ...changes, version: sql`${storageProviders.version} + 1`, updatedAt: now })
        .where(
          and(
            eq(storageProviders.id, mutation.tableId),
            eq(storageProviders.organizationId, organizationId),
            eq(storageProviders.version, mutation.baseVersion),
          ),
        )
        .returning();
      if (row) {
        return applied(mutation, row);
      }
      const current = await findRow(tx, mutation.tableName, organizationId, mutation.tableId);
      return current ? conflict(mutation, current) : rejected(mutation, 'Storage provider not found.');
    }
  }
}

async function applyDelete(
  tx: Transaction,
  organizationId: string,
  mutation: SyncMutation,
): Promise<SyncMutationResult> {
  const now = new Date();

  switch (mutation.tableName) {
    case 'albums': {
      const [row] = await tx
        .update(albums)
        .set({ deletedAt: now, version: sql`${albums.version} + 1`, updatedAt: now })
        .where(
          and(
            eq(albums.id, mutation.tableId),
            eq(albums.organizationId, organizationId),
            eq(albums.version, mutation.baseVersion),
          ),
        )
        .returning();
      if (row) {
        return applied(mutation, row);
      }
      const current = await findRow(tx, mutation.tableName, organizationId, mutation.tableId);
      return current ? conflict(mutation, current) : rejected(mutation, 'Album not found.');
    }
    case 'photos': {
      const [row] = await tx
        .update(photos)
        .set({ deletedAt: now, version: sql`${photos.version} + 1`, updatedAt: now })
        .where(
          and(
            eq(photos.id, mutation.tableId),
            eq(photos.organizationId, organizationId),
            eq(photos.version, mutation.baseVersion),
          ),
        )
        .returning();
      if (row) {
        return applied(mutation, row);
      }
      const current = await findRow(tx, mutation.tableName, organizationId, mutation.tableId);
      return current ? conflict(mutation, current) : rejected(mutation, 'Photo not found.');
    }
    case 'photo_locations': {
      const [row] = await tx
        .update(photoLocations)
        .set({
          deletedAt: now,
          version: sql`${photoLocations.version} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(photoLocations.id, mutation.tableId),
            eq(photoLocations.organizationId, organizationId),
            eq(photoLocations.version, mutation.baseVersion),
          ),
        )
        .returning();
      if (row) {
        return applied(mutation, row);
      }
      const current = await findRow(tx, mutation.tableName, organizationId, mutation.tableId);
      return current ? conflict(mutation, current) : rejected(mutation, 'Photo location not found.');
    }
    case 'storage_providers': {
      const [row] = await tx
        .update(storageProviders)
        .set({
          deletedAt: now,
          version: sql`${storageProviders.version} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(storageProviders.id, mutation.tableId),
            eq(storageProviders.organizationId, organizationId),
            eq(storageProviders.version, mutation.baseVersion),
          ),
        )
        .returning();
      if (row) {
        return applied(mutation, row);
      }
      const current = await findRow(tx, mutation.tableName, organizationId, mutation.tableId);
      return current ? conflict(mutation, current) : rejected(mutation, 'Storage provider not found.');
    }
  }
}

async function applyMutation(
  organizationId: string,
  mutation: SyncMutation,
): Promise<SyncMutationResult> {
  try {
    return await db.transaction(async (tx) => {
      const claimed = await tx
        .insert(syncMutations)
        .values({
          mutationId: mutation.mutationId,
          organizationId,
          operation: mutation.operation,
          tableName: mutation.tableName,
          tableId: mutation.tableId,
          payload: mutation.payload ?? {},
          status: 'applied',
          error: null,
          record: {},
        })
        .onConflictDoNothing()
        .returning({ mutationId: syncMutations.mutationId });

      if (claimed.length === 0) {
        const [existing] = await tx
          .select({
            result: syncMutations.record,
            status: syncMutations.status,
            error: syncMutations.error,
          })
          .from(syncMutations)
          .where(eq(syncMutations.mutationId, mutation.mutationId))
          .limit(1);
        const record = (existing?.result as Row | undefined) ?? null;
        if (existing?.status) {
          return {
            mutationId: mutation.mutationId,
            status: 'duplicate',
            error: existing.error ?? undefined,
            record,
          };
        }
        return {
          mutationId: mutation.mutationId,
          status: 'duplicate',
          error: 'This mutation is already being processed. Retry shortly.',
          record: null,
        };
      }

      let result: SyncMutationResult;
      if (mutation.operation === 'insert') {
        result = await applyInsert(tx, organizationId, mutation);
      } else if (mutation.operation === 'update') {
        result = await applyUpdate(tx, organizationId, mutation);
      } else {
        result = await applyDelete(tx, organizationId, mutation);
      }

      await tx
        .update(syncMutations)
        .set({
          status: result.status,
          error: result.error ?? null,
          record: (result.record ?? {}) as Row,
        })
        .where(eq(syncMutations.mutationId, mutation.mutationId));

      return result;
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return rejected(
        mutation,
        `Invalid ${mutation.tableName} payload: ${error.issues
          .map((issue) => issue.message)
          .join('; ')}`,
      );
    }
    if (error instanceof SyncForbiddenError) {
      return rejected(mutation, error.message);
    }
    throw error;
  }
}

export async function applySyncMutations(
  organizationId: string,
  mutations: SyncMutation[],
): Promise<SyncMutationResult[]> {
  const results: SyncMutationResult[] = [];
  for (const mutation of mutations) {
    results.push(await applyMutation(organizationId, mutation));
  }
  return results;
}
