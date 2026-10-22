import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { v7 as uuidv7 } from 'uuid';

import { authOrganization } from '../external/auth-tables';

export const albums = pgTable('albums', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => authOrganization.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const albumSelectSchema = createSelectSchema(albums);
export const albumInsertSchema = createInsertSchema(albums);

export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;
