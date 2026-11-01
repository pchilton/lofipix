import { isNull, useLiveQuery } from '@tanstack/solid-db';
import { getAlbumsCollection, getPhotosCollection } from './db/collections';

export function useLiveAlbums() {
  return useLiveQuery((q) =>
    q
      .from({ album: getAlbumsCollection() })
      .where(({ album }) => isNull(album.deletedAt))
      .orderBy(({ album }) => album.updatedAt, 'desc'),
  );
}

export function useLivePhotos() {
  return useLiveQuery((q) =>
    q
      .from({ photo: getPhotosCollection() })
      .where(({ photo }) => isNull(photo.deletedAt))
      .orderBy(({ photo }) => photo.position, 'asc'),
  );
}
