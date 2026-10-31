import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';

import { authOrganization } from '../external/auth-tables';

const providerTypeValues = ['opfs', 's3', 'onedrive', 'google_drive'] as const;

export const storageProviderType = pgEnum('storage_provider_type', [
  ...providerTypeValues,
]);

export const storageProviders = pgTable(
  'storage_providers',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => authOrganization.id, { onDelete: 'cascade' }),
    providerType: storageProviderType('provider_type').notNull(),
    label: text('label').notNull(),
    externalId: text('external_id').notNull(),
    config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
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
      'storage_providers_label_non_empty',
      sql`length(btrim(${table.label})) > 0`,
    ),
    check(
      'storage_providers_external_id_non_empty',
      sql`length(btrim(${table.externalId})) > 0`,
    ),
    check(
      'storage_providers_config_object',
      sql`jsonb_typeof(${table.config}) = 'object'`,
    ),
    check(
      'storage_providers_encrypted_data_object',
      sql`NOT (${table.config} ? 'encrypted_data') OR jsonb_typeof(${table.config} -> 'encrypted_data') = 'object'`,
    ),
    check(
      'storage_providers_opfs_platform',
      sql`${table.providerType} <> 'opfs' OR (${table.config} ? 'platform' AND ${table.config} ->> 'platform' IN ('ios', 'android'))`,
    ),
    uniqueIndex('storage_providers_org_type_external_unique')
      .on(table.organizationId, table.providerType, table.externalId)
      .where(sql`${table.deletedAt} IS NULL`),
    index('storage_providers_organization_id_idx').on(table.organizationId),
  ],
);

const providerConfig = z.object({}).catchall(z.any());

const stripEncryptedData = (config: Record<string, unknown>): Record<string, unknown> => {
  const { encrypted_data, ...rest } = config;
  return rest;
};

export const storageProviderSelectSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  providerType: z.enum(providerTypeValues),
  label: z.string().min(1),
  externalId: z.string().min(1),
  config: providerConfig.transform(stripEncryptedData),
  deletedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const storageProviderServerSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  providerType: z.enum(providerTypeValues),
  label: z.string().min(1),
  externalId: z.string().min(1),
  config: providerConfig,
  deletedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const storageProviderInsertSchema = z.object({
  organizationId: z.string(),
  providerType: z.enum(providerTypeValues),
  label: z.string().min(1),
  externalId: z.string().min(1),
  config: providerConfig,
});

export type StorageProvider = z.infer<typeof storageProviderSelectSchema>;
export type NewStorageProvider = z.infer<typeof storageProviderInsertSchema>;
