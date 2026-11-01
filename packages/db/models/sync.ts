import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';

import { authOrganization } from '../external/auth-tables';

export const syncTables = [
  'albums',
  'photos',
  'photo_locations',
  'storage_providers',
] as const;

export const syncOperationTypes = ['insert', 'update', 'delete'] as const;
export const syncMutationStatuses = [
  'applied',
  'conflict',
  'rejected',
  'duplicate',
] as const;

export const syncMutationSchema = z.object({
  mutationId: z.uuid(),
  table: z.enum(syncTables),
  operation: z.enum(syncOperationTypes),
  recordId: z.uuid(),
  baseVersion: z.number().int().nonnegative(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const syncMutationsRequestSchema = z.object({
  mutations: z.array(syncMutationSchema).min(1).max(500),
});

export const syncMutationResultSchema = z.object({
  mutationId: z.uuid(),
  status: z.enum(syncMutationStatuses),
  version: z.number().int().positive().optional(),
  row: z.record(z.string(), z.unknown()).nullable().optional(),
  error: z.string().optional(),
});

export const syncMutationsResponseSchema = z.object({
  results: z.array(syncMutationResultSchema),
});

export const syncMutations = pgTable(
  'sync_mutations',
  {
    mutationId: uuid('mutation_id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => authOrganization.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    tableName: text('table_name').notNull(),
    recordId: uuid('record_id').notNull(),
    operation: text('operation').notNull(),
    result: jsonb('result').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('sync_mutations_created_at_idx').on(table.createdAt),
    index('sync_mutations_organization_id_idx').on(table.organizationId),
    check(
      'sync_mutations_operation_valid',
      sql`${table.operation} in ('insert', 'update', 'delete')`,
    ),
  ],
);

export type SyncTable = (typeof syncTables)[number];
export type SyncOperationType = (typeof syncOperationTypes)[number];
export type SyncMutationStatus = (typeof syncMutationStatuses)[number];
export type SyncMutation = z.infer<typeof syncMutationSchema>;
export type SyncMutationsRequest = z.infer<typeof syncMutationsRequestSchema>;
export type SyncMutationResult = z.infer<typeof syncMutationResultSchema>;
export type SyncMutationsResponse = z.infer<typeof syncMutationsResponseSchema>;
