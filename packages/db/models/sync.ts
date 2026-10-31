import { z } from 'zod';

export const syncTables = ['albums', 'photos'] as const;

export const syncOperationSchema = z.object({
  op: z.enum(['PUT', 'PATCH', 'DELETE']),
  table: z.enum(syncTables),
  id: z.uuid(),
  opData: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const syncUploadRequestSchema = z.object({
  operations: z.array(syncOperationSchema).min(1).max(500),
});

export const syncUploadResponseSchema = z.object({
  applied: z.number().int().nonnegative(),
});

export type SyncOperation = z.infer<typeof syncOperationSchema>;
export type SyncUploadRequest = z.infer<typeof syncUploadRequestSchema>;
export type SyncUploadResponse = z.infer<typeof syncUploadResponseSchema>;
