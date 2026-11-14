import { createCollection } from '@tanstack/react-db';
import { powerSyncCollectionOptions } from '@tanstack/powersync-db-collection';
import { z } from 'zod';

import { powerSync } from './client';
import { AppSchema } from './schema';

const timestamps = {
  originated_at: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
};

export const albumSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  name: z.string(),
  notes: z.string().nullable(),
  version: z.number(),
  ...timestamps,
});

export const photoSchema = z.object({
  id: z.string(),
  album_id: z.string(),
  position: z.number(),
  image_width: z.number(),
  image_height: z.number(),
  image_quality: z.number(),
  image_size: z.number(),
  image_checksum: z.string().nullable(),
  version: z.number(),
  ...timestamps,
});

export const photoLocationSchema = z.object({
  id: z.string(),
  photo_id: z.string(),
  storage_provider_id: z.string(),
  object_key: z.string(),
  version: z.number(),
  ...timestamps,
});

export const storageProviderSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  provider_type: z.string(),
  label: z.string(),
  external_id: z.string(),
  config: z.string().nullable(),
  version: z.number(),
  ...timestamps,
});

export type Album = z.infer<typeof albumSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type PhotoLocation = z.infer<typeof photoLocationSchema>;
export type StorageProvider = z.infer<typeof storageProviderSchema>;

export const albumsCollection = createCollection(
  powerSyncCollectionOptions({
    database: powerSync,
    table: AppSchema.props.albums,
    schema: albumSchema,
    onDeserializationError: (error) => {
      console.error('Invalid album row from sync:', error);
    },
  }),
);

export const photosCollection = createCollection(
  powerSyncCollectionOptions({
    database: powerSync,
    table: AppSchema.props.photos,
    schema: photoSchema,
    onDeserializationError: (error) => {
      console.error('Invalid photo row from sync:', error);
    },
  }),
);

export const photoLocationsCollection = createCollection(
  powerSyncCollectionOptions({
    database: powerSync,
    table: AppSchema.props.photo_locations,
    schema: photoLocationSchema,
    onDeserializationError: (error) => {
      console.error('Invalid photo location row from sync:', error);
    },
  }),
);

export const storageProvidersCollection = createCollection(
  powerSyncCollectionOptions({
    database: powerSync,
    table: AppSchema.props.storage_providers,
    schema: storageProviderSchema,
    onDeserializationError: (error) => {
      console.error('Invalid storage provider row from sync:', error);
    },
  }),
);
