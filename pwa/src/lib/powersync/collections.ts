import { createCollection, type Transaction } from '@tanstack/solid-db';
import { powerSyncCollectionOptions, PowerSyncTransactor } from '@tanstack/powersync-db-collection';
import { z } from 'zod';
import { powerSyncDatabase } from './database';
import { refreshPendingIds } from './status';
import { APP_SCHEMA } from './schema';

const nullableText = z.string().nullable();

const albumRecordSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  name: z.string(),
  notes: nullableText,
  deleted_at: nullableText,
  created_at: z.string(),
  updated_at: z.string(),
});

const photoRecordSchema = z.object({
  id: z.string(),
  album_id: z.string(),
  position: z.number().int(),
  image_width: z.number().int(),
  image_height: z.number().int(),
  image_quality: z.number().int(),
  image_size: z.number().int(),
  captured_at: z.string(),
  image_checksum: nullableText,
  deleted_at: nullableText,
  created_at: z.string(),
  updated_at: z.string(),
});

export type AlbumRecord = z.infer<typeof albumRecordSchema>;
export type PhotoRecord = z.infer<typeof photoRecordSchema>;

function reportDeserializationError(table: string) {
  return (error: { issues: ReadonlyArray<{ message: string }> }) => {
    console.error(`Invalid ${table} row from PowerSync:`, error.issues.map((issue) => issue.message).join('; '));
  };
}

const transactor = new PowerSyncTransactor({ database: powerSyncDatabase });

const collectionMutation = async ({ transaction }: { transaction: Transaction<any> }) => {
  await transactor.applyTransaction(transaction);
  await refreshPendingIds();
};

const albumOptions = powerSyncCollectionOptions({
  database: powerSyncDatabase,
  table: APP_SCHEMA.props.albums,
  schema: albumRecordSchema,
  deserializationSchema: albumRecordSchema,
  onDeserializationError: reportDeserializationError('albums'),
});

export const albumsCollection = createCollection({
  ...albumOptions,
  onInsert: collectionMutation,
  onUpdate: collectionMutation,
  onDelete: collectionMutation,
});

const photoOptions = powerSyncCollectionOptions({
  database: powerSyncDatabase,
  table: APP_SCHEMA.props.photos,
  schema: photoRecordSchema,
  deserializationSchema: photoRecordSchema,
  onDeserializationError: reportDeserializationError('photos'),
});

export const photosCollection = createCollection({
  ...photoOptions,
  onInsert: collectionMutation,
  onUpdate: collectionMutation,
  onDelete: collectionMutation,
});

export async function persistWrite<T extends object>(transaction: Transaction<T>): Promise<void> {
  const settled = await transaction.when('settled');
  if (settled.state === 'failed') {
    throw new Error(settled.error?.message ?? 'The local write failed.');
  }
  if (settled.state !== 'completed') {
    throw new Error('The local write did not complete.');
  }
}
