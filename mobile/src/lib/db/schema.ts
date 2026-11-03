import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const LOCAL_SCHEMA_VERSION = 1;

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
};

export const albums = sqliteTable(
  'albums',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    name: text('name').notNull(),
    notes: text('notes'),
    version: integer('version').notNull().default(1),
    outboxNeeded: integer('outbox_needed', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [index('albums_organization_id_idx').on(table.organizationId)],
);

export const photos = sqliteTable(
  'photos',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    albumId: text('album_id').notNull(),
    position: integer('position').notNull(),
    imageWidth: integer('image_width').notNull(),
    imageHeight: integer('image_height').notNull(),
    imageQuality: integer('image_quality').notNull(),
    imageSize: integer('image_size').notNull(),
    capturedAt: integer('captured_at', { mode: 'timestamp_ms' }).notNull(),
    imageChecksum: text('image_checksum'),
    version: integer('version').notNull().default(1),
    outboxNeeded: integer('outbox_needed', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [
    index('photos_album_id_idx').on(table.albumId),
    index('photos_organization_id_idx').on(table.organizationId),
  ],
);

export const photoLocations = sqliteTable(
  'photo_locations',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    photoId: text('photo_id').notNull(),
    storageProviderId: text('storage_provider_id').notNull(),
    objectKey: text('object_key').notNull(),
    version: integer('version').notNull().default(1),
    outboxNeeded: integer('outbox_needed', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [
    index('photo_locations_photo_id_idx').on(table.photoId),
    index('photo_locations_organization_id_idx').on(table.organizationId),
  ],
);

export const storageProviders = sqliteTable(
  'storage_providers',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    providerType: text('provider_type').notNull(),
    label: text('label').notNull(),
    externalId: text('external_id').notNull(),
    config: text('config').notNull().default('{}'),
    version: integer('version').notNull().default(1),
    outboxNeeded: integer('outbox_needed', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [index('storage_providers_organization_id_idx').on(table.organizationId)],
);

export const outbox = sqliteTable(
  'outbox',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull(),
    operation: text('operation').notNull(),
    payload: text('payload').notNull().default('{}'),
    baseVersion: integer('base_version').notNull().default(0),
    status: text('status').notNull().default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: integer('next_attempt_at', { mode: 'timestamp_ms' }).notNull(),
    lastError: text('last_error'),
    ...timestamps,
  },
  (table) => [
    index('outbox_status_next_attempt_idx').on(table.status, table.nextAttemptAt),
    index('outbox_record_idx').on(table.recordId),
  ],
);

export const localMeta = sqliteTable('local_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const syncTableObjects = {
  albums,
  photos,
  photo_locations: photoLocations,
  storage_providers: storageProviders,
} as const;

export type LocalAlbum = typeof albums.$inferSelect;
export type LocalPhoto = typeof photos.$inferSelect;
export type LocalPhotoLocation = typeof photoLocations.$inferSelect;
export type LocalStorageProvider = typeof storageProviders.$inferSelect;
export type OutboxRow = typeof outbox.$inferSelect;
export type OutboxStatus = 'pending' | 'inflight' | 'failed' | 'dead';
