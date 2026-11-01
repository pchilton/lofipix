import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
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
    encryptedData: jsonb('encrypted_data').notNull().default(sql`'{}'::jsonb`),
    version: bigint('version', { mode: 'number' }).notNull().default(1),
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
      sql`jsonb_typeof(${table.encryptedData}) = 'object'`,
    ),
    check(
      'storage_providers_opfs_platform',
      sql`${table.providerType} <> 'opfs' OR (${table.config} ? 'platform' AND ${table.config} ->> 'platform' IN ('ios', 'android'))`,
    ),
    unique('storage_providers_id_organization_unique').on(
      table.id,
      table.organizationId,
    ),
    uniqueIndex('storage_providers_org_type_external_unique')
      .on(table.organizationId, table.providerType, table.externalId)
      .where(sql`${table.deletedAt} IS NULL`),
    index('storage_providers_organization_id_idx').on(table.organizationId),
    check('storage_providers_version_positive', sql`${table.version} > 0`),
  ],
);

const providerConfig = z.object({}).catchall(z.unknown());

export const storageProviderSelectSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  providerType: z.enum(providerTypeValues),
  label: z.string().min(1),
  externalId: z.string().min(1),
  config: providerConfig,
  version: z.number().int().positive(),
  deletedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const storageProviderServerSchema = storageProviderSelectSchema.extend({
  encryptedData: providerConfig,
});

export const storageProviderInsertSchema = z.object({
  organizationId: z.string(),
  providerType: z.enum(providerTypeValues),
  label: z.string().min(1),
  externalId: z.string().min(1),
  config: providerConfig.default({}),
  encryptedData: providerConfig.default({}),
});

export type StorageProvider = z.infer<typeof storageProviderSelectSchema>;
export type NewStorageProvider = z.infer<typeof storageProviderInsertSchema>;
