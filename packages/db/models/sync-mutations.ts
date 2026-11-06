import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgEnum,
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
  operation: z.enum(syncOperationTypes),
  tableName: z.enum(syncTables),
  tableId: z.uuid(),
  baseVersion: z.number().int().positive(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const syncMutationsRequestSchema = z.object({
  mutations: z.array(syncMutationSchema).min(1).max(500),
});

export const syncMutationResultSchema = z.object({
  mutationId: z.uuid(),
  status: z.enum(syncMutationStatuses),
  error: z.string().optional(),
  record: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const syncMutationsResponseSchema = z.object({
  results: z.array(syncMutationResultSchema),
});

export const syncOperationType = pgEnum('sync_operation_type', [
  ...syncOperationTypes,
]);
export const syncMutationStatus = pgEnum('sync_mutation_status', [
  ...syncMutationStatuses,
]);
export const syncMutations = pgTable(
  'sync_mutations',
  {
    mutationId: uuid('mutation_id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => authOrganization.id, { onDelete: 'cascade' }),
    operation: syncOperationType('operation').notNull(),
    tableName: text('table_name').notNull(),
    tableId: uuid('table_id').notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    status: syncMutationStatus('status').notNull(),
    error: text('error'),
    record: jsonb('record').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sync_mutations_organization_id_idx').on(table.organizationId),
  ],
);

export type SyncTable = (typeof syncTables)[number];
export type SyncOperationType = (typeof syncOperationTypes)[number];
export type SyncMutationStatus = (typeof syncMutationStatuses)[number];
export type SyncMutation = z.infer<typeof syncMutationSchema>;
export type SyncMutationsRequest = z.infer<typeof syncMutationsRequestSchema>;
export type SyncMutationResult = z.infer<typeof syncMutationResultSchema>;
export type SyncMutationsResponse = z.infer<typeof syncMutationsResponseSchema>;
