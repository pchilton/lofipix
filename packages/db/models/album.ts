import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
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
  notes: text('notes'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const normalizeNotes = (value: string): string | null => {
  const normalized = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalized.length > 0 ? normalized : null;
};

const albumRefinements = {
  notes: (schema: z.ZodString) => schema.transform(normalizeNotes),
};

export const albumSelectSchema = createSelectSchema(albums, albumRefinements);
export const albumInsertSchema = createInsertSchema(albums, albumRefinements);

export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;
