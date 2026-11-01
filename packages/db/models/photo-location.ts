import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';

import { authOrganization } from '../external/auth-tables';
import { photos } from './photo';
import { storageProviders } from './storage-provider';

export const photoLocations = pgTable(
  'photo_locations',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => authOrganization.id, { onDelete: 'cascade' }),
    photoId: uuid('photo_id').notNull(),
    storageProviderId: uuid('storage_provider_id').notNull(),
    objectKey: text('object_key').notNull(),
    version: bigint('version', { mode: 'number' }).notNull().default(1),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.photoId, table.organizationId],
      foreignColumns: [photos.id, photos.organizationId],
      name: 'photo_locations_photo_organization_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.storageProviderId, table.organizationId],
      foreignColumns: [storageProviders.id, storageProviders.organizationId],
      name: 'photo_locations_provider_organization_fk',
    }).onDelete('cascade'),
    check(
      'photo_locations_object_key_non_empty',
      sql`length(btrim(${table.objectKey})) > 0`,
    ),
    uniqueIndex('photo_locations_photo_provider_unique')
      .on(table.photoId, table.storageProviderId)
      .where(sql`${table.deletedAt} IS NULL`),
    index('photo_locations_storage_provider_id_idx').on(table.storageProviderId),
    index('photo_locations_photo_id_idx').on(table.photoId),
    index('photo_locations_organization_id_idx').on(table.organizationId),
    check('photo_locations_version_positive', sql`${table.version} > 0`),
  ],
);

export const photoLocationSelectSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  photoId: z.string().uuid(),
  storageProviderId: z.string().uuid(),
  objectKey: z.string().min(1),
  version: z.number().int().positive(),
  deletedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const photoLocationInsertSchema = z.object({
  photoId: z.string().uuid(),
  storageProviderId: z.string().uuid(),
  objectKey: z.string().min(1),
});

export type PhotoLocation = z.infer<typeof photoLocationSelectSchema>;
export type NewPhotoLocation = z.infer<typeof photoLocationInsertSchema>;
