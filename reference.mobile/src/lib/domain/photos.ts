import { v7 as uuidv7 } from 'uuid';

import { photosCollection } from '../db/collections';
import { powerSync } from '../db/client';
import {
  compressAndStorePhoto,
  deletePhotoBytes,
  PHOTO_IMAGE_QUALITY,
  type CameraCapture,
  type StoredPhoto,
} from '../photo-capture';

export interface CapturedPhoto {
  width: number;
  height: number;
  quality: number;
  size: number;
  checksum: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function nextPosition(albumId: string): Promise<number> {
  const row = await powerSync.getOptional<{ max: number | null }>(
    'select max(position) as max from photos where album_id = ? and deleted_at is null',
    [albumId],
  );
  return (row?.max ?? 0) + 1;
}

export async function insertPhoto(
  albumId: string,
  captured: CapturedPhoto,
  id: string = uuidv7(),
): Promise<string> {
  const now = nowIso();
  photosCollection.insert({
    id,
    album_id: albumId,
    position: await nextPosition(albumId),
    image_width: captured.width,
    image_height: captured.height,
    image_quality: captured.quality || PHOTO_IMAGE_QUALITY,
    image_size: captured.size,
    image_checksum: captured.checksum,
    version: 0,
    originated_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  return id;
}

export async function deletePhoto(photoId: string): Promise<void> {
  if (!photosCollection.get(photoId)) {
    return;
  }
  photosCollection.delete(photoId);
  await deletePhotoBytes(photoId);
}

export async function capturePhoto(
  albumId: string,
  capture: CameraCapture,
): Promise<string> {
  const id = uuidv7();
  const stored: StoredPhoto = await compressAndStorePhoto(id, capture);
  await insertPhoto(albumId, stored, id);
  return id;
}
