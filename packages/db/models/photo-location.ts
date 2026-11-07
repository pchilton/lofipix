import {
  integer,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';

import { photos } from './photo';
import { storageProviders } from './storage-provider';

export const photoLocations = pgTable(
  'photo_locations',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    photoId: uuid('photo_id').notNull().references(() => photos.id, { onDelete: 'cascade' }),
    storageProviderId: uuid('storage_provider_id').notNull().references(() => storageProviders.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(),
    version: integer('version').notNull().default(1),
    originatedAt: timestamp('originated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('photo_locations_organization_id_idx').on(table.organizationId),
    index('photo_locations_storage_provider_id_idx').on(table.storageProviderId),
    index('photo_locations_photo_id_idx').on(table.photoId),
  ],
);

const photoLocationRefinements = {
  objectKey: (schema: z.ZodString) => schema.min(1),
};

export const photoLocationSelectSchema = createSelectSchema(photoLocations, photoLocationRefinements);
export const photoLocationInsertSchema = createInsertSchema(photoLocations, photoLocationRefinements);

export type PhotoLocation = z.infer<typeof photoLocationSelectSchema>;
export type NewPhotoLocation = z.infer<typeof photoLocationInsertSchema>;
