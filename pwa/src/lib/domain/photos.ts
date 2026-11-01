import { v7 as uuidv7 } from 'uuid';
import { getAlbumsCollection, getPhotosCollection } from '../db/collections';
import { persistWrite } from '../db/persist';
import { captureFrame, PHOTO_IMAGE_QUALITY } from '../photo-capture';
import { savePhotoBytes } from '../photos-storage';

export function nextPosition(albumId: string): number {
  let max = 0;
  for (const photo of getPhotosCollection().toArray) {
    if (
      photo.albumId === albumId &&
      photo.deletedAt === null &&
      (photo.position ?? 0) > max
    ) {
      max = photo.position ?? 0;
    }
  }
  return max + 1;
}

export async function capturePhoto(
  albumId: string,
  video: HTMLVideoElement,
): Promise<string> {
  const album = getAlbumsCollection().get(albumId);
  if (!album) {
    throw new Error('The album is not available on this device.');
  }

  const frame = await captureFrame(video);
  const id = uuidv7();
  const position = nextPosition(albumId);
  await savePhotoBytes(id, frame.blob);

  const now = new Date();
  const transaction = getPhotosCollection().insert({
    id,
    organizationId: album.organizationId,
    albumId,
    position,
    imageWidth: frame.width,
    imageHeight: frame.height,
    imageQuality: PHOTO_IMAGE_QUALITY,
    imageSize: frame.blob.size,
    capturedAt: now,
    imageChecksum: frame.checksum,
    version: 0,
    outboxNeeded: true,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  await persistWrite(transaction);
  return id;
}

export async function deletePhoto(photoId: string): Promise<void> {
  const now = new Date();
  const transaction = getPhotosCollection().update(photoId, (draft) => {
    draft.deletedAt = now;
    draft.outboxNeeded = true;
    draft.updatedAt = now;
  });
  await persistWrite(transaction);
}
