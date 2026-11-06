import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { getDb } from '../db/client';
import { photos } from '../db/schema';
import { queueInsert, queueUpdate } from '../outbox';
import { bumpRevision } from '../revision';
import { compressAndStorePhoto, deletePhotoBytes, PHOTO_IMAGE_QUALITY, type CameraCapture, type StoredPhoto } from '../photo-capture';

export interface CapturedPhoto {
  width: number;
  height: number;
  quality: number;
  size: number;
  checksum: string;
}

export async function nextPosition(albumId: string): Promise<number> {
  const rows = await getDb().select({ position: photos.position }).from(photos).where(eq(photos.albumId, albumId));
  let max = 0;
  for (const row of rows) {
    max = Math.max(max, row.position);
  }
  return max + 1;
}

export async function insertPhoto(
  albumId: string,
  organizationId: string,
  captured: CapturedPhoto,
  id: string = uuidv7(),
): Promise<string> {
  const now = new Date();
  const row = {
    id,
    organizationId,
    albumId,
    position: await nextPosition(albumId),
    imageWidth: captured.width,
    imageHeight: captured.height,
    imageQuality: captured.quality || PHOTO_IMAGE_QUALITY,
    imageSize: captured.size,
    imageChecksum: captured.checksum,
    version: 0,
    outboxNeeded: true,
    originatedAt: now,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await getDb().insert(photos).values(row);
  queueInsert('photos', row);
  bumpRevision();
  return id;
}

export async function deletePhoto(photoId: string): Promise<void> {
  const [original] = await getDb().select().from(photos).where(eq(photos.id, photoId)).limit(1);
  if (!original) {
    return;
  }
  const changes = {
    deletedAt: new Date(),
    outboxNeeded: true,
    updatedAt: new Date(),
  };
  if (original.version === 0) {
    await getDb().delete(photos).where(eq(photos.id, photoId));
  } else {
    await getDb().update(photos).set(changes).where(eq(photos.id, photoId));
  }
  queueUpdate('photos', original, changes);
  await deletePhotoBytes(photoId);
  bumpRevision();
}

export async function listPhotos() {
  return getDb().select().from(photos);
}

export async function capturePhoto(
  albumId: string,
  organizationId: string,
  capture: CameraCapture,
): Promise<string> {
  const id = uuidv7();
  const stored: StoredPhoto = await compressAndStorePhoto(id, capture);
  await insertPhoto(albumId, organizationId, stored, id);
  return id;
}
