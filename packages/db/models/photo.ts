import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
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
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => authOrganization.id, { onDelete: 'cascade' }),
    albumId: uuid('album_id').notNull(),
    position: integer('position').notNull(),
    imageWidth: integer('image_width').notNull(),
    imageHeight: integer('image_height').notNull(),
    imageQuality: integer('image_quality').notNull(),
    imageSize: integer('image_size').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    imageChecksum: text('image_checksum'),
    version: bigint('version', { mode: 'number' }).notNull().default(1),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.albumId, table.organizationId],
      foreignColumns: [albums.id, albums.organizationId],
      name: 'photos_album_organization_fk',
    }).onDelete('cascade'),
    index('photos_album_id_idx').on(table.albumId),
    index('photos_organization_id_idx').on(table.organizationId),
    unique('photos_id_organization_unique').on(table.id, table.organizationId),
    uniqueIndex('photos_album_id_position_unique')
      .on(table.albumId, table.position)
      .where(sql`${table.deletedAt} is null`),
    check('photos_position_positive', sql`${table.position} > 0`),
    check('photos_image_width_positive', sql`${table.imageWidth} > 0`),
    check('photos_image_height_positive', sql`${table.imageHeight} > 0`),
    check('photos_image_quality_range', sql`${table.imageQuality} between 1 and 100`),
    check('photos_image_size_non_negative', sql`${table.imageSize} >= 0`),
    check('photos_version_positive', sql`${table.version} > 0`),
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
