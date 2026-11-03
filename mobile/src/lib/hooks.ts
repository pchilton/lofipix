import { useQuery } from '@tanstack/react-query';

import { listAlbums } from './domain/albums';
import { listPhotos } from './domain/photos';
import { useRevision } from './revision';
import { useOutboxState } from './outbox-store';
import { allShapesUpToDate, shapeError, useShapeStates } from './sync-status';

export function useAlbums() {
  const revision = useRevision();
  return useQuery({
    queryKey: ['albums', revision],
    queryFn: async () => {
      const rows = await listAlbums();
      return rows
        .filter((album) => album.deletedAt == null)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    },
  });
}

export function usePhotos() {
  const revision = useRevision();
  return useQuery({
    queryKey: ['photos', revision],
    queryFn: async () => {
      const rows = await listPhotos();
      return rows
        .filter((photo) => photo.deletedAt == null)
        .sort((a, b) => a.position - b.position);
    },
  });
}

export function useAlbum(albumId: string) {
  const albums = useAlbums();
  return {
    ...albums,
    data: albums.data?.find((album) => album.id === albumId),
  };
}

export function useAlbumPhotos(albumId: string) {
  const photos = usePhotos();
  return {
    ...photos,
    data: photos.data?.filter((photo) => photo.albumId === albumId) ?? [],
  };
}

export function usePendingIds(): ReadonlySet<string> {
  const state = useOutboxState();
  return state.pendingIds;
}

export function useSyncLabel(): string {
  const outbox = useOutboxState();
  useShapeStates();

  if (!outbox.online) return 'Offline';
  if (outbox.uploading) return 'Uploading';
  if (outbox.error) return 'Sync error';
  if (outbox.pendingCount > 0) return `${outbox.pendingCount} queued`;
  if (shapeError()) return 'Sync error';
  if (allShapesUpToDate()) return 'Connected';
  return 'Syncing';
}
