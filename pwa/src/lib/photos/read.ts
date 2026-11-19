import {
  albumSelectSchema,
  photoSelectSchema,
  type Album,
  type Photo,
} from "@lofipix/db/schema";
import { useLiveQuery } from "@tanstack/react-db";
import { useMemo } from "react";

import { albumsCollection, photosCollection } from "../db/collections";
import type { AlbumRow, PhotoRow } from "../db/schema";

function dateValue(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

export function toAlbum(row: AlbumRow): Album | null {
  const parsed = albumSelectSchema.safeParse({
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    notes: row.notes,
    version: row.version,
    originatedAt: dateValue(row.originated_at),
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
    deletedAt: dateValue(row.deleted_at),
  });
  return parsed.success ? parsed.data : null;
}

export function toPhoto(row: PhotoRow): Photo | null {
  const parsed = photoSelectSchema.safeParse({
    id: row.id,
    albumId: row.album_id,
    position: row.position,
    imageWidth: row.image_width,
    imageHeight: row.image_height,
    imageQuality: row.image_quality,
    imageSize: row.image_size,
    imageChecksum: row.image_checksum,
    version: row.version,
    originatedAt: dateValue(row.originated_at),
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
    deletedAt: dateValue(row.deleted_at),
  });
  return parsed.success ? parsed.data : null;
}

export function useAlbums(): {
  albums: Album[];
  isLoading: boolean;
  hasError: boolean;
} {
  const query = useLiveQuery((q) => q.from({ albums: albumsCollection }));
  const albums = useMemo(() => {
    return ((query.data ?? []) as AlbumRow[])
      .map(toAlbum)
      .filter((album): album is Album => album !== null && album.deletedAt === null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [query.data]);

  return { albums, isLoading: query.isLoading, hasError: query.isLoadingError };
}

export function useAllPhotos(): {
  photos: Photo[];
  isLoading: boolean;
  hasError: boolean;
} {
  const query = useLiveQuery((q) => q.from({ photos: photosCollection }));
  const photos = useMemo(() => {
    return ((query.data ?? []) as PhotoRow[])
      .map(toPhoto)
      .filter((photo): photo is Photo => photo !== null && photo.deletedAt === null)
      .sort((a, b) => a.position - b.position);
  }, [query.data]);

  return { photos, isLoading: query.isLoading, hasError: query.isLoadingError };
}

export function useAlbumPhotos(albumId: string): {
  photos: Photo[];
  isLoading: boolean;
  hasError: boolean;
} {
  const query = useLiveQuery((q) => q.from({ photos: photosCollection }));
  const photos = useMemo(() => {
    return ((query.data ?? []) as PhotoRow[])
      .map(toPhoto)
      .filter(
        (photo): photo is Photo =>
          photo !== null && photo.deletedAt === null && photo.albumId === albumId,
      )
      .sort((a, b) => a.position - b.position);
  }, [query.data, albumId]);

  return { photos, isLoading: query.isLoading, hasError: query.isLoadingError };
}

export function useAlbum(albumId: string): {
  album: Album | null;
  isLoading: boolean;
  hasError: boolean;
} {
  const { albums, isLoading, hasError } = useAlbums();
  return {
    album: albums.find((album) => album.id === albumId) ?? null,
    isLoading,
    hasError,
  };
}

export function usePhoto(
  albumId: string,
  photoId: string,
): {
  photo: Photo | null;
  photos: Photo[];
  isLoading: boolean;
  hasError: boolean;
} {
  const { photos, isLoading, hasError } = useAlbumPhotos(albumId);
  return {
    photo: photos.find((photo) => photo.id === photoId) ?? null,
    photos,
    isLoading,
    hasError,
  };
}