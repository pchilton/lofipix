import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';

import { authOrganization } from '../external/auth-tables';

const providerTypeValues = ['opfs', 'app_fs', 's3', 'onedrive', 'google_drive'] as const;
export const storageProviderType = pgEnum('storage_provider_type', [ ...providerTypeValues ]);
const providerTypeSchema = z.enum(providerTypeValues);

export const storageProviders = pgTable(
  'storage_providers',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    organizationId: text('organization_id').notNull().references(() => authOrganization.id, { onDelete: 'cascade' }),
    providerType: storageProviderType('provider_type').notNull(),
    label: text('label').notNull(),
    externalId: text('external_id').notNull(),
    config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
    encryptedData: jsonb('encrypted_data').notNull().default(sql`'{}'::jsonb`),
    version: integer('version').notNull().default(1),
    originatedAt: timestamp('originated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('storage_providers_organization_id_idx').on(table.organizationId),
  ],
);

const storageProviderRefinements = {
  label: (schema: z.ZodString) => schema.min(1),
  externalId: (schema: z.ZodString) => schema.min(1),
  providerType: (schema: typeof providerTypeSchema) => schema,
};

export const storageProviderSelectSchema = createSelectSchema(storageProviders, storageProviderRefinements);
export const storageProviderInsertSchema = createInsertSchema(storageProviders, storageProviderRefinements);

export type StorageProvider = z.infer<typeof storageProviderSelectSchema>;
export type NewStorageProvider = z.infer<typeof storageProviderInsertSchema>;
