import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

export const albums = pgTable('albums', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => Bun.randomUUIDv7()),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const albumSelectSchema = createSelectSchema(albums);
export const albumInsertSchema = createInsertSchema(albums);

export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;
