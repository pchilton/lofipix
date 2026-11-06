import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';

import { authOrganization } from '../external/auth-tables';
import { albums } from './album';

export const photos = pgTable(
  'photos',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    organizationId: text('organization_id').notNull().references(() => authOrganization.id, { onDelete: 'cascade' }),
    albumId: uuid('album_id').notNull().references(() => albums.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    imageWidth: integer('image_width').notNull(),
    imageHeight: integer('image_height').notNull(),
    imageQuality: integer('image_quality').notNull(),
    imageSize: integer('image_size').notNull(),
    imageChecksum: text('image_checksum'),
    version: integer('version').notNull().default(1),
    originatedAt: timestamp('originated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('photos_album_id_idx').on(table.albumId),
    index('photos_organization_id_idx').on(table.organizationId),
  ],
);

const photoRefinements = {
  position: (schema: z.ZodInt) => schema.positive(),
  imageWidth: (schema: z.ZodInt) => schema.positive(),
  imageHeight: (schema: z.ZodInt) => schema.positive(),
  imageQuality: (schema: z.ZodInt) => schema.min(1).max(100),
  imageSize: (schema: z.ZodInt) => schema.nonnegative(),
  imageChecksum: (schema: z.ZodString) => schema.regex(/^[0-9a-f]{64}$/),
};

export const photoSelectSchema = createSelectSchema(photos, photoRefinements);
export const photoInsertSchema = createInsertSchema(photos, photoRefinements);

export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
