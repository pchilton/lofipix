import { Schema, Table, column } from '@powersync/react-native';

const albums = new Table(
  {
    organization_id: column.text,
    name: column.text,
    notes: column.text,
    version: column.integer,
    originated_at: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  {
    indexes: {
      albums_organization_id: ['organization_id'],
    },
  },
);

const photos = new Table(
  {
    album_id: column.text,
    position: column.integer,
    image_width: column.integer,
    image_height: column.integer,
    image_quality: column.integer,
    image_size: column.integer,
    image_checksum: column.text,
    version: column.integer,
    originated_at: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  {
    indexes: {
      photos_album_id: ['album_id'],
    },
  },
);

const photoLocations = new Table(
  {
    photo_id: column.text,
    storage_provider_id: column.text,
    object_key: column.text,
    version: column.integer,
    originated_at: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  {
    indexes: {
      photo_locations_photo_id: ['photo_id'],
      photo_locations_storage_provider_id: ['storage_provider_id'],
    },
  },
);

const storageProviders = new Table(
  {
    organization_id: column.text,
    provider_type: column.text,
    label: column.text,
    external_id: column.text,
    config: column.text,
    version: column.integer,
    originated_at: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  {
    indexes: {
      storage_providers_organization_id: ['organization_id'],
    },
  },
);

export const AppSchema = new Schema({
  albums,
  photos,
  photo_locations: photoLocations,
  storage_providers: storageProviders,
});

export type AlbumRow = (typeof AppSchema)['types']['albums'];
export type PhotoRow = (typeof AppSchema)['types']['photos'];
export type PhotoLocationRow = (typeof AppSchema)['types']['photo_locations'];
export type StorageProviderRow = (typeof AppSchema)['types']['storage_providers'];
