import { sql } from 'drizzle-orm';
import {
  check,
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
    check(
      'storage_providers_device_platform_check',
      sql`(${table.providerType} <> 'opfs' AND ${table.providerType} <> 'app_fs') OR (jsonb_typeof(${table.config}) = 'object' AND ${table.config} ? 'platform' AND ${table.config} ->> 'platform' IN ('ios', 'android', 'web'))`,
    ),
  ],
);

const storageProviderRefinements = {
  label: (schema: z.ZodString) => schema.min(1),
  externalId: (schema: z.ZodString) => schema.min(1),
  providerType: (schema: typeof providerTypeSchema) => schema,
};

const devicePlatformValues = ['ios', 'android', 'web'] as const;

function devicePlatformIsValid(row: { providerType?: unknown; config?: unknown }): boolean {
  if (row.providerType !== 'opfs' && row.providerType !== 'app_fs') {
    return true;
  }
  if (!row.config || typeof row.config !== 'object') {
    return false;
  }
  const platform = (row.config as Record<string, unknown>).platform;
  return (
    typeof platform === 'string' &&
    (devicePlatformValues as readonly string[]).includes(platform)
  );
}


export const storageProviderSelectSchema = createSelectSchema(
  storageProviders,
  storageProviderRefinements,
).refine(devicePlatformIsValid, {
  path: ['config', 'platform'],
  message: 'Device storage providers require platform ios, android or web.',
});
export const storageProviderInsertSchema = createInsertSchema(
  storageProviders,
  storageProviderRefinements,
).refine(devicePlatformIsValid, {
  path: ['config', 'platform'],
  message: 'Device storage providers require platform ios, android or web.',
});

export type StorageProvider = z.infer<typeof storageProviderSelectSchema>;
export type NewStorageProvider = z.infer<typeof storageProviderInsertSchema>;
