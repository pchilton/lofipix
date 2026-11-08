import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@lofipix/db';
import {
  albumInsertSchema,
  albums,
  localRowToServer,
  photoInsertSchema,
  photoLocationInsertSchema,
  photoLocations,
  photos,
  storageProviderInsertSchema,
  storageProviders,
  type SyncUploadEntry,
  type SyncUploadResult,
} from '@lofipix/db/schema';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Row = Record<string, unknown>;

// PMC: should this come from packages/db/models/storage-providers
const providerTypeSchema = z.enum([
  'opfs',
  'app_fs',
  's3',
  'onedrive',
  'google_drive',
]);
const configSchema = z.record(z.string(), z.unknown());

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
    version: true,
    deletedAt: true,
    updatedAt: true,
  })
  .strict();

const photoUpdatePayload = photoCreatePayload
  .partial()
  .omit({ albumId: true, createdAt: true, originatedAt: true });

const photoLocationCreatePayload = photoLocationInsertSchema
  .omit({
    id: true,
    version: true,
    deletedAt: true,
    updatedAt: true,
  })
  .strict();

const photoLocationUpdatePayload = z
  .object({ objectKey: z.string().trim().min(1).optional() })
  .strict();

const storageProviderCreatePayload = storageProviderInsertSchema
  .omit({
    id: true,
    organizationId: true,
    version: true,
    deletedAt: true,
    updatedAt: true,
  })
  .strict();

const storageProviderUpdatePayload = z
  .object({
    providerType: providerTypeSchema.optional(),
    label: z.string().trim().min(1).optional(),
    externalId: z.string().trim().min(1).optional(),
    config: configSchema.optional(),
  })
  .strict();

function payloadFor(entry: SyncUploadEntry): Record<string, unknown> {
  const payload = localRowToServer(entry.table, entry.opData);
  delete payload.version;
  delete payload.deletedAt;
  delete payload.updatedAt;
  if (entry.table === 'albums' || entry.table === 'storage_providers') {
    delete payload.organizationId;
  }
  if (entry.table === 'storage_providers' && typeof payload.config === 'string') {
    payload.config = JSON.parse(payload.config) as unknown;
  }
  for (const field of ['createdAt', 'updatedAt', 'originatedAt', 'deletedAt']) {
    if (typeof payload[field] === 'string') {
      payload[field] = new Date(payload[field] as string);
    }
  }
  return payload;
}

function rejected(entry: SyncUploadEntry, error: string): SyncUploadResult {
  return { opId: entry.opId, status: 'rejected', error };
}

function alreadyApplied(
  entry: SyncUploadEntry,
  row: Row | undefined,
): SyncUploadResult {
  return row
    ? {
        opId: entry.opId,
        status: 'already-applied',
        record: row,
      }
    : { opId: entry.opId, status: 'already-applied' };
}

function conflict(entry: SyncUploadEntry, row: Row): SyncUploadResult {
  return {
    opId: entry.opId,
    status: 'conflict',
    record: row,
  };
}

function applied(entry: SyncUploadEntry, row: Row): SyncUploadResult {
  return {
    opId: entry.opId,
    status: 'applied',
    record: row,
  };
}

async function findAlbum(
  tx: Transaction,
  organizationId: string,
  id: string,
): Promise<Row | undefined> {
  const [row] = await tx
    .select()
    .from(albums)
    .where(and(eq(albums.id, id), eq(albums.organizationId, organizationId)))
    .limit(1);
  return row;
}

async function findPhoto(
  tx: Transaction,
  organizationId: string,
  id: string,
): Promise<Row | undefined> {
  const [row] = await tx
    .select({ photo: photos })
    .from(photos)
    .innerJoin(albums, eq(photos.albumId, albums.id))
    .where(and(eq(photos.id, id), eq(albums.organizationId, organizationId)))
    .limit(1);
  return row?.photo;
}

async function findPhotoLocation(
  tx: Transaction,
  organizationId: string,
  id: string,
): Promise<Row | undefined> {
  const [row] = await tx
    .select({ location: photoLocations })
    .from(photoLocations)
    .innerJoin(photos, eq(photoLocations.photoId, photos.id))
    .innerJoin(albums, eq(photos.albumId, albums.id))
    .where(
      and(
        eq(photoLocations.id, id),
        eq(albums.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row?.location;
}

async function findStorageProvider(
  tx: Transaction,
  organizationId: string,
  id: string,
): Promise<Row | undefined> {
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

async function albumInOrganization(
  tx: Transaction,
  organizationId: string,
  albumId: string,
): Promise<boolean> {
  return Boolean(await findAlbum(tx, organizationId, albumId));
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

async function insertAlbum(
  tx: Transaction,
  organizationId: string,
  entry: SyncUploadEntry,
): Promise<SyncUploadResult> {
  const existing = await findAlbum(tx, organizationId, entry.id);
  if (existing) {
    return alreadyApplied(entry, existing);
  }
  const values = albumCreatePayload.parse(payloadFor(entry));
  const [row] = await tx
    .insert(albums)
    .values({
      ...values,
      id: entry.id,
      organizationId,
      version: 1,
    } as typeof albums.$inferInsert)
    .onConflictDoNothing()
    .returning();
  return row ? applied(entry, row) : rejected(entry, 'Album id already exists.');
}

async function updateAlbum(
  tx: Transaction,
  organizationId: string,
  entry: SyncUploadEntry,
): Promise<SyncUploadResult> {
  const current = await findAlbum(tx, organizationId, entry.id);
  if (!current) {
    return rejected(entry, 'Album not found.');
  }
  if (current.deletedAt) {
    return rejected(entry, 'Album is deleted.');
  }
  if (current.version !== entry.baseVersion) {
    return conflict(entry, current);
  }
  const values = albumUpdatePayload.parse(payloadFor(entry));
  const [row] = await tx
    .update(albums)
    .set({
      ...values,
      updatedAt: new Date(),
      version: sql`${albums.version} + 1`,
    })
    .where(and(eq(albums.id, entry.id), eq(albums.version, entry.baseVersion)))
    .returning();
  return row ? applied(entry, row) : conflict(entry, current);
}

async function deleteAlbum(
  tx: Transaction,
  organizationId: string,
  entry: SyncUploadEntry,
): Promise<SyncUploadResult> {
  const current = await findAlbum(tx, organizationId, entry.id);
  if (!current) {
    return rejected(entry, 'Album not found.');
  }
  if (current.deletedAt) {
    return alreadyApplied(entry, current);
  }
  if (current.version !== entry.baseVersion) {
    return conflict(entry, current);
  }
  const [row] = await tx
    .update(albums)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      version: sql`${albums.version} + 1`,
    })
    .where(and(eq(albums.id, entry.id), eq(albums.version, entry.baseVersion)))
    .returning();
  return row ? applied(entry, row) : conflict(entry, current);
}

async function insertPhoto(
  tx: Transaction,
  organizationId: string,
  entry: SyncUploadEntry,
): Promise<SyncUploadResult> {
  const existing = await findPhoto(tx, organizationId, entry.id);
  if (existing) {
    return alreadyApplied(entry, existing);
  }
  const values = photoCreatePayload.parse(payloadFor(entry));
  if (!(await albumInOrganization(tx, organizationId, values.albumId))) {
    return rejected(entry, 'Parent album is outside the organisation.');
  }
  const [row] = await tx
    .insert(photos)
    .values({ ...values, id: entry.id, version: 1 } as typeof photos.$inferInsert)
    .onConflictDoNothing()
    .returning();
  return row ? applied(entry, row) : rejected(entry, 'Photo id already exists.');
}

async function updatePhoto(
  tx: Transaction,
  organizationId: string,
  entry: SyncUploadEntry,
): Promise<SyncUploadResult> {
  const current = await findPhoto(tx, organizationId, entry.id);
  if (!current) {
    return rejected(entry, 'Photo not found.');
  }
  if (current.deletedAt) {
    return rejected(entry, 'Photo is deleted.');
  }
  if (current.version !== entry.baseVersion) {
    return conflict(entry, current);
  }
  const values = photoUpdatePayload.parse(payloadFor(entry));
  const [row] = await tx
    .update(photos)
    .set({
      ...values,
      updatedAt: new Date(),
      version: sql`${photos.version} + 1`,
    })
    .where(and(eq(photos.id, entry.id), eq(photos.version, entry.baseVersion)))
    .returning();
  return row ? applied(entry, row) : conflict(entry, current);
}

async function deletePhoto(
  tx: Transaction,
  organizationId: string,
  entry: SyncUploadEntry,
): Promise<SyncUploadResult> {
  const current = await findPhoto(tx, organizationId, entry.id);
  if (!current) {
    return rejected(entry, 'Photo not found.');
  }
  if (current.deletedAt) {
    return alreadyApplied(entry, current);
  }
  if (current.version !== entry.baseVersion) {
    return conflict(entry, current);
  }
  const [row] = await tx
    .update(photos)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      version: sql`${photos.version} + 1`,
    })
    .where(and(eq(photos.id, entry.id), eq(photos.version, entry.baseVersion)))
    .returning();
  return row ? applied(entry, row) : conflict(entry, current);
}

async function insertPhotoLocation(
  tx: Transaction,
  organizationId: string,
  entry: SyncUploadEntry,
): Promise<SyncUploadResult> {
  const existing = await findPhotoLocation(tx, organizationId, entry.id);
  if (existing) {
    return alreadyApplied(entry, existing);
  }
  const values = photoLocationCreatePayload.parse(payloadFor(entry));
  if (!(await findPhoto(tx, organizationId, values.photoId))) {
    return rejected(entry, 'Parent photo is outside the organisation.');
  }
  if (
    !(await findStorageProvider(tx, organizationId, values.storageProviderId))
  ) {
    return rejected(entry, 'Storage provider is outside the organisation.');
  }
  const [row] = await tx
    .insert(photoLocations)
    .values({
      ...values,
      id: entry.id,
      version: 1,
    } as typeof photoLocations.$inferInsert)
    .onConflictDoNothing()
    .returning();
  return row
    ? applied(entry, row)
    : rejected(entry, 'Photo location id already exists.');
}

async function updatePhotoLocation(
  tx: Transaction,
  organizationId: string,
  entry: SyncUploadEntry,
): Promise<SyncUploadResult> {
  const current = await findPhotoLocation(tx, organizationId, entry.id);
  if (!current) {
    return rejected(entry, 'Photo location not found.');
  }
  if (current.deletedAt) {
    return rejected(entry, 'Photo location is deleted.');
  }
  if (current.version !== entry.baseVersion) {
    return conflict(entry, current);
  }
  const values = photoLocationUpdatePayload.parse(payloadFor(entry));
  const [row] = await tx
    .update(photoLocations)
    .set({
      ...values,
      updatedAt: new Date(),
      version: sql`${photoLocations.version} + 1`,
    })
    .where(
      and(
        eq(photoLocations.id, entry.id),
        eq(photoLocations.version, entry.baseVersion),
      ),
    )
    .returning();
  return row ? applied(entry, row) : conflict(entry, current);
}

async function deletePhotoLocation(
  tx: Transaction,
  organizationId: string,
  entry: SyncUploadEntry,
): Promise<SyncUploadResult> {
  const current = await findPhotoLocation(tx, organizationId, entry.id);
  if (!current) {
    return rejected(entry, 'Photo location not found.');
  }
  if (current.deletedAt) {
    return alreadyApplied(entry, current);
  }
  if (current.version !== entry.baseVersion) {
    return conflict(entry, current);
  }
  const [row] = await tx
    .update(photoLocations)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      version: sql`${photoLocations.version} + 1`,
    })
    .where(
      and(
        eq(photoLocations.id, entry.id),
        eq(photoLocations.version, entry.baseVersion),
      ),
    )
    .returning();
  return row ? applied(entry, row) : conflict(entry, current);
}

async function insertStorageProvider(
  tx: Transaction,
  organizationId: string,
  entry: SyncUploadEntry,
): Promise<SyncUploadResult> {
  const existing = await findStorageProvider(tx, organizationId, entry.id);
  if (existing) {
    return alreadyApplied(entry, existing);
  }
  const values = storageProviderCreatePayload.parse(payloadFor(entry));
  const [row] = await tx
    .insert(storageProviders)
    .values({
      ...values,
      id: entry.id,
      organizationId,
      version: 1,
    } as typeof storageProviders.$inferInsert)
    .onConflictDoNothing()
    .returning();
  return row
    ? applied(entry, row)
    : rejected(entry, 'Storage provider id already exists.');
}

async function updateStorageProvider(
  tx: Transaction,
  organizationId: string,
  entry: SyncUploadEntry,
): Promise<SyncUploadResult> {
  const current = await findStorageProvider(tx, organizationId, entry.id);
  if (!current) {
    return rejected(entry, 'Storage provider not found.');
  }
  if (current.deletedAt) {
    return rejected(entry, 'Storage provider is deleted.');
  }
  if (current.version !== entry.baseVersion) {
    return conflict(entry, current);
  }
  const values = storageProviderUpdatePayload.parse(payloadFor(entry));
  const [row] = await tx
    .update(storageProviders)
    .set({
      ...values,
      updatedAt: new Date(),
      version: sql`${storageProviders.version} + 1`,
    })
    .where(
      and(
        eq(storageProviders.id, entry.id),
        eq(storageProviders.version, entry.baseVersion),
      ),
    )
    .returning();
  return row ? applied(entry, row) : conflict(entry, current);
}

async function deleteStorageProvider(
  tx: Transaction,
  organizationId: string,
  entry: SyncUploadEntry,
): Promise<SyncUploadResult> {
  const current = await findStorageProvider(tx, organizationId, entry.id);
  if (!current) {
    return rejected(entry, 'Storage provider not found.');
  }
  if (current.deletedAt) {
    return alreadyApplied(entry, current);
  }
  if (current.version !== entry.baseVersion) {
    return conflict(entry, current);
  }
  const [row] = await tx
    .update(storageProviders)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      version: sql`${storageProviders.version} + 1`,
    })
    .where(
      and(
        eq(storageProviders.id, entry.id),
        eq(storageProviders.version, entry.baseVersion),
      ),
    )
    .returning();
  return row ? applied(entry, row) : conflict(entry, current);
}

async function applyOne(
  tx: Transaction,
  organizationId: string,
  entry: SyncUploadEntry,
): Promise<SyncUploadResult> {
  switch (entry.table) {
    case 'albums':
      if (entry.op === 'PUT') return insertAlbum(tx, organizationId, entry);
      if (entry.op === 'PATCH') return updateAlbum(tx, organizationId, entry);
      return deleteAlbum(tx, organizationId, entry);
    case 'photos':
      if (entry.op === 'PUT') return insertPhoto(tx, organizationId, entry);
      if (entry.op === 'PATCH') return updatePhoto(tx, organizationId, entry);
      return deletePhoto(tx, organizationId, entry);
    case 'photo_locations':
      if (entry.op === 'PUT') {
        return insertPhotoLocation(tx, organizationId, entry);
      }
      if (entry.op === 'PATCH') {
        return updatePhotoLocation(tx, organizationId, entry);
      }
      return deletePhotoLocation(tx, organizationId, entry);
    case 'storage_providers':
      if (entry.op === 'PUT') {
        return insertStorageProvider(tx, organizationId, entry);
      }
      if (entry.op === 'PATCH') {
        return updateStorageProvider(tx, organizationId, entry);
      }
      return deleteStorageProvider(tx, organizationId, entry);
  }
}

export async function applySyncUploads(
  organizationId: string,
  uploads: readonly SyncUploadEntry[],
): Promise<SyncUploadResult[]> {
  const results: SyncUploadResult[] = [];
  for (const entry of uploads) {
    try {
      results.push(
        await db.transaction((tx) => applyOne(tx, organizationId, entry)),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        results.push({ opId: entry.opId, status: 'already-applied' });
        continue;
      }
      results.push(
        rejected(
          entry,
          error instanceof Error ? error.message : 'Upload failed.',
        ),
      );
    }
  }
  return results;
}
