import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';

import { photos } from './photo';
import { storageProviders } from './storage-provider';

export const photoLocations = pgTable(
  'photo_locations',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    photoId: uuid('photo_id')
      .notNull()
      .references(() => photos.id, { onDelete: 'cascade' }),
    storageProviderId: uuid('storage_provider_id')
      .notNull()
      .references(() => storageProviders.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'photo_locations_object_key_non_empty',
      sql`length(btrim(${table.objectKey})) > 0`,
    ),
    uniqueIndex('photo_locations_photo_provider_unique')
      .on(table.photoId, table.storageProviderId)
      .where(sql`${table.deletedAt} IS NULL`),
    index('photo_locations_storage_provider_id_idx').on(table.storageProviderId),
    index('photo_locations_photo_id_idx').on(table.photoId),
  ],
);

export const photoLocationSelectSchema = z.object({
  id: z.string().uuid(),
  photoId: z.string().uuid(),
  storageProviderId: z.string().uuid(),
  objectKey: z.string().min(1),
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
