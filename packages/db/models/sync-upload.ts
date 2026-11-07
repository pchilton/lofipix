import { z } from 'zod';

export const syncTableNames = [
  'albums',
  'photos',
  'photo_locations',
  'storage_providers',
] as const;

export type SyncTableName = (typeof syncTableNames)[number];

export const syncUploadOperations = ['PUT', 'PATCH', 'DELETE'] as const;

export type SyncUploadOperation = (typeof syncUploadOperations)[number];

export const syncUploadEntrySchema = z.object({
  op: z.enum(syncUploadOperations),
  table: z.enum(syncTableNames),
  id: z.string().uuid(),
  opData: z
    .record(z.string(), z.unknown())
    .nullish()
    .transform((value) => value ?? {}),
  opId: z.number().int(),
  clientId: z.string().min(1),
  baseVersion: z.number().int().nonnegative(),
});

export type SyncUploadEntry = z.infer<typeof syncUploadEntrySchema>;

export const syncUploadRequestSchema = z.object({
  uploads: z.array(syncUploadEntrySchema).min(1).max(500),
});

export type SyncUploadRequest = z.infer<typeof syncUploadRequestSchema>;

export const syncUploadStatuses = [
  'applied',
  'conflict',
  'rejected',
  'already-applied',
] as const;

export type SyncUploadStatus = (typeof syncUploadStatuses)[number];

export const syncUploadResultSchema = z.object({
  opId: z.number().int(),
  status: z.enum(syncUploadStatuses),
  record: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
});

export type SyncUploadResult = z.infer<typeof syncUploadResultSchema>;

export const syncUploadResponseSchema = z.object({
  results: z.array(syncUploadResultSchema),
});

export type SyncUploadResponse = z.infer<typeof syncUploadResponseSchema>;

export const syncTableColumnMap = {
  albums: {
    organization_id: 'organizationId',
    name: 'name',
    notes: 'notes',
    version: 'version',
    originated_at: 'originatedAt',
    created_at: 'createdAt',
    updated_at: 'updatedAt',
    deleted_at: 'deletedAt',
  },
  photos: {
    album_id: 'albumId',
    position: 'position',
    image_width: 'imageWidth',
    image_height: 'imageHeight',
    image_quality: 'imageQuality',
    image_size: 'imageSize',
    image_checksum: 'imageChecksum',
    version: 'version',
    originated_at: 'originatedAt',
    created_at: 'createdAt',
    updated_at: 'updatedAt',
    deleted_at: 'deletedAt',
  },
  photo_locations: {
    photo_id: 'photoId',
    storage_provider_id: 'storageProviderId',
    object_key: 'objectKey',
    version: 'version',
    originated_at: 'originatedAt',
    created_at: 'createdAt',
    updated_at: 'updatedAt',
    deleted_at: 'deletedAt',
  },
  storage_providers: {
    organization_id: 'organizationId',
    provider_type: 'providerType',
    label: 'label',
    external_id: 'externalId',
    config: 'config',
    version: 'version',
    originated_at: 'originatedAt',
    created_at: 'createdAt',
    updated_at: 'updatedAt',
    deleted_at: 'deletedAt',
  },
} as const satisfies Record<SyncTableName, Record<string, string>>;

function reverseColumns(table: SyncTableName): Record<string, string> {
  return Object.fromEntries(
    Object.entries(syncTableColumnMap[table]).map(([local, server]) => [
      server,
      local,
    ]),
  );
}

export function localRowToServer(
  table: SyncTableName,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const columns = syncTableColumnMap[table];
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const serverKey = columns[key as keyof typeof columns];
    if (serverKey) {
      output[serverKey] = value;
    }
  }
  return output;
}

function localValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value !== null && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

export function serverRowToLocal(
  table: SyncTableName,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const columns = reverseColumns(table);
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const localKey = key === 'id' ? 'id' : columns[key];
    if (localKey) {
      output[localKey] = localValue(value);
    }
  }
  return output;
}
