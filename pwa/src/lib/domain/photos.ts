import { v7 as uuidv7 } from 'uuid';
import { photosCollection, persistWrite } from '../powersync/collections';
import { captureFrame, PHOTO_IMAGE_QUALITY } from '../photo-capture';
import { savePhotoBytes } from '../photos-storage';

export function nextPosition(albumId: string): number {
  let max = 0;
  for (const photo of photosCollection.toArray) {
    if (photo.album_id === albumId && photo.deleted_at === null && (photo.position ?? 0) > max) {
      max = photo.position ?? 0;
    }
  }
  return max + 1;
}

export async function capturePhoto(albumId: string, video: HTMLVideoElement): Promise<string> {
  const frame = await captureFrame(video);
  const id = uuidv7();
  const position = nextPosition(albumId);
  await savePhotoBytes(id, frame.blob);

  const now = new Date();
  const transaction = photosCollection.insert({
    id,
    album_id: albumId,
    position,
    image_width: frame.width,
    image_height: frame.height,
    image_quality: PHOTO_IMAGE_QUALITY,
    image_size: frame.blob.size,
    captured_at: now.toISOString(),
    image_checksum: frame.checksum,
    deleted_at: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
  await persistWrite(transaction);
  return id;
}

export async function deletePhoto(photoId: string): Promise<void> {
  const transaction = photosCollection.update(photoId, (draft) => {
    const now = new Date().toISOString();
    draft.deleted_at = now;
    draft.updated_at = now;
  });
  await persistWrite(transaction);
}
