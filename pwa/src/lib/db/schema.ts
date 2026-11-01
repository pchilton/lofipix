import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { SyncTable } from '@lofipix/db/schema';

export const LOCAL_SCHEMA_VERSION = 1;

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
};

export const albums = pgTable(
  'albums',
  {
    id: uuid('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    name: text('name').notNull(),
    notes: text('notes'),
    version: bigint('version', { mode: 'number' }).notNull().default(1),
    outboxNeeded: boolean('outbox_needed').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [index('albums_organization_id_idx').on(table.organizationId)],
);

export const photos = pgTable(
  'photos',
  {
    id: uuid('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    albumId: uuid('album_id').notNull(),
    position: integer('position').notNull(),
    imageWidth: integer('image_width').notNull(),
    imageHeight: integer('image_height').notNull(),
    imageQuality: integer('image_quality').notNull(),
    imageSize: integer('image_size').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true, mode: 'date' }).notNull(),
    imageChecksum: text('image_checksum'),
    version: bigint('version', { mode: 'number' }).notNull().default(1),
    outboxNeeded: boolean('outbox_needed').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('photos_album_id_idx').on(table.albumId),
    index('photos_organization_id_idx').on(table.organizationId),
  ],
);

export const photoLocations = pgTable(
  'photo_locations',
  {
    id: uuid('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    photoId: uuid('photo_id').notNull(),
    storageProviderId: uuid('storage_provider_id').notNull(),
    objectKey: text('object_key').notNull(),
    version: bigint('version', { mode: 'number' }).notNull().default(1),
    outboxNeeded: boolean('outbox_needed').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('photo_locations_photo_id_idx').on(table.photoId),
    index('photo_locations_organization_id_idx').on(table.organizationId),
  ],
);

export const storageProviders = pgTable(
  'storage_providers',
  {
    id: uuid('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    providerType: text('provider_type').notNull(),
    label: text('label').notNull(),
    externalId: text('external_id').notNull(),
    config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
    version: bigint('version', { mode: 'number' }).notNull().default(1),
    outboxNeeded: boolean('outbox_needed').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('storage_providers_organization_id_idx').on(table.organizationId),
  ],
);

export const outbox = pgTable(
  'outbox',
  {
    id: uuid('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    tableName: text('table_name').notNull(),
    recordId: uuid('record_id').notNull(),
    operation: text('operation').notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    baseVersion: bigint('base_version', { mode: 'number' }).notNull().default(0),
    status: text('status').notNull().default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', {
      withTimezone: true,
      mode: 'date',
    })
      .notNull()
      .defaultNow(),
    lastError: text('last_error'),
    ...timestamps,
  },
  (table) => [
    index('outbox_status_next_attempt_idx').on(
      table.status,
      table.nextAttemptAt,
    ),
    index('outbox_record_idx').on(table.recordId),
  ],
);

export const localMeta = pgTable('local_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const localSyncTables = {
  albums,
  photos,
  photo_locations: photoLocations,
  storage_providers: storageProviders,
} as const satisfies Record<SyncTable, unknown>;

export type LocalSyncTable = keyof typeof localSyncTables;

export type LocalAlbum = typeof albums.$inferSelect;
export type LocalPhoto = typeof photos.$inferSelect;
export type LocalPhotoLocation = typeof photoLocations.$inferSelect;
export type LocalStorageProvider = typeof storageProviders.$inferSelect;
export type OutboxRow = typeof outbox.$inferSelect;
