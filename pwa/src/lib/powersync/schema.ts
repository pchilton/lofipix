import { column, Schema, Table } from '@powersync/web';

const albums = new Table({
  organization_id: column.text,
  name: column.text,
  notes: column.text,
  deleted_at: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const photos = new Table({
  album_id: column.text,
  position: column.integer,
  image_width: column.integer,
  image_height: column.integer,
  image_quality: column.integer,
  image_size: column.integer,
  captured_at: column.text,
  image_checksum: column.text,
  deleted_at: column.text,
  created_at: column.text,
  updated_at: column.text,
});

export const APP_SCHEMA = new Schema({
  albums,
  photos,
});

export type AppDatabaseSchema = typeof APP_SCHEMA;
