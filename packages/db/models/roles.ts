import { relations } from 'drizzle-orm';
import { pgEnum, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { user } from './auth';
import { organisations } from './organisation';

export const organisationRoleEnum = pgEnum('role', ['owner', 'admin', 'member', 'finances']);

export const roleValues = ['owner', 'admin', 'member', 'finances'] as const;
export type OrganisationRole = (typeof roleValues)[number];

export const roleSchema = z.enum(roleValues);

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().$defaultFn(() => Bun.randomUUIDv7()),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: organisationRoleEnum('role').notNull(),
  },
  (table) => [
    uniqueIndex('roles_organisation_user_role_unique').on(
      table.organisationId,
      table.userId,
      table.role,
    ),
  ],
);

export const rolesRelations = relations(roles, ({ one }) => ({
  organisation: one(organisations, {
    fields: [roles.organisationId],
    references: [organisations.id],
  }),
  user: one(user, {
    fields: [roles.userId],
    references: [user.id],
  }),
}));

export const roleSelectSchema = createSelectSchema(roles, {
  role: roleSchema,
});

export const roleInsertSchema = createInsertSchema(roles, {
  role: roleSchema,
});

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
