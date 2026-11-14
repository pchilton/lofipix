import { eq, isNull, useLiveQuery } from '@tanstack/react-db';
import { useStatus } from '@powersync/react';

import {
  albumsCollection,
  photosCollection,
  type Album,
  type Photo,
} from './db/collections';

export type LiveAlbum = Album & { $hasPendingWrites?: boolean };
export type LivePhoto = Photo & { $hasPendingWrites?: boolean };

export function useAlbums() {
  const { data, isLoading, isLoadingError, isSyncError } = useLiveQuery({
    query: (q) =>
      q
        .from({ album: albumsCollection })
        .where(({ album }) => isNull(album.deleted_at))
        .orderBy(({ album }) => album.updated_at, 'desc'),
  });
  return {
    data: data as LiveAlbum[],
    isLoading,
    error: isLoadingError || isSyncError ? 'Sync error' : null,
  };
}

export function usePhotos() {
  const { data, isLoading, isLoadingError, isSyncError } = useLiveQuery({
    query: (q) =>
      q
        .from({ photo: photosCollection })
        .where(({ photo }) => isNull(photo.deleted_at))
        .orderBy(({ photo }) => photo.position, 'asc'),
  });
  return {
    data: data as LivePhoto[],
    isLoading,
    error: isLoadingError || isSyncError ? 'Sync error' : null,
  };
}

export function useAlbum(albumId: string) {
  const { data, isLoading, isLoadingError, isSyncError } = useLiveQuery({
    query: (q) =>
      q
        .from({ album: albumsCollection })
        .where(({ album }) => eq(album.id, albumId))
        .where(({ album }) => isNull(album.deleted_at)),
  });
  return {
    data: data?.[0] as LiveAlbum | undefined,
    isLoading,
    error: isLoadingError || isSyncError ? 'Sync error' : null,
  };
}

export function useAlbumPhotos(albumId: string) {
  const { data, isLoading, isLoadingError, isSyncError } = useLiveQuery({
    query: (q) =>
      q
        .from({ photo: photosCollection })
        .where(({ photo }) => eq(photo.album_id, albumId))
        .where(({ photo }) => isNull(photo.deleted_at))
        .orderBy(({ photo }) => photo.position, 'asc'),
  });
  return {
    data: data as LivePhoto[],
    isLoading,
    error: isLoadingError || isSyncError ? 'Sync error' : null,
  };
}

export function useSyncLabel(): string {
  const status = useStatus();
  if (!status.connected) return 'Offline';
  if (status.dataFlowStatus?.uploading) return 'Uploading';
  if (status.uploadError || status.downloadError) return 'Sync error';
  if (!status.hasSynced || status.dataFlowStatus?.downloading) return 'Syncing';
  return 'Connected';
}
