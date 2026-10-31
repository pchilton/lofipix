import { isNull, useLiveQuery } from '@tanstack/solid-db';
import { albumsCollection, photosCollection } from './powersync/collections';

export function useLiveAlbums() {
  return useLiveQuery((q) =>
    q
      .from({ album: albumsCollection })
      .where(({ album }) => isNull(album.deleted_at))
      .orderBy(({ album }) => album.updated_at, 'desc'),
  );
}

export function useLivePhotos() {
  return useLiveQuery((q) =>
    q
      .from({ photo: photosCollection })
      .where(({ photo }) => isNull(photo.deleted_at))
      .orderBy(({ photo }) => photo.position, 'asc'),
  );
}
