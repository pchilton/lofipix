import ImageResizer from '@bam.tech/react-native-image-resizer';
import { Dirs, FileSystem } from 'react-native-file-access';

export const PHOTO_MAX_WIDTH = 1280;
export const PHOTO_TARGET_BYTES = 300_000;
export const PHOTO_JPEG_QUALITY = 0.82;
export const PHOTO_IMAGE_QUALITY = Math.round(PHOTO_JPEG_QUALITY * 100);

const PHOTO_DIRECTORY = `${Dirs.DocumentDir}/photos`;

export interface CameraCapture {
  uri: string;
  width: number;
  height: number;
}

export interface StoredPhoto {
  path: string;
  width: number;
  height: number;
  quality: number;
  size: number;
  checksum: string;
}

async function ensurePhotoDirectory(): Promise<void> {
  if (!(await FileSystem.exists(PHOTO_DIRECTORY))) {
    await FileSystem.mkdir(PHOTO_DIRECTORY);
  }
}

export function photoPath(photoId: string): string {
  return `${PHOTO_DIRECTORY}/${photoId}.jpg`;
}

function dimensions(sourceWidth: number, sourceHeight: number): { width: number; height: number } {
  const scale = Math.min(1, PHOTO_MAX_WIDTH / sourceWidth);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

export async function compressAndStorePhoto(photoId: string, capture: CameraCapture): Promise<StoredPhoto> {
  await ensurePhotoDirectory();
  const path = photoPath(photoId);
  const size = dimensions(capture.width, capture.height);

  let quality = PHOTO_IMAGE_QUALITY;
  let result = await ImageResizer.createResizedImage(
    capture.uri,
    size.width,
    size.height,
    'JPEG',
    quality,
    0,
    path,
    false,
  );

  while (result.size > PHOTO_TARGET_BYTES && quality > 40) {
    quality = Math.max(40, quality - 8);
    result = await ImageResizer.createResizedImage(
      capture.uri,
      size.width,
      size.height,
      'JPEG',
      quality,
      0,
      path,
      false,
    );
  }

  const stat = await FileSystem.stat(path);
  const checksum = await FileSystem.hash(path, 'SHA-256');

  return {
    path,
    width: result.width,
    height: result.height,
    quality,
    size: stat.size,
    checksum: checksum.toLowerCase(),
  };
}

export async function loadPhotoUri(photoId: string): Promise<string | null> {
  const path = photoPath(photoId);
  if (!(await FileSystem.exists(path))) {
    return null;
  }
  return path.startsWith('file://') ? path : `file://${path}`;
}

export async function deletePhotoBytes(photoId: string): Promise<void> {
  const path = photoPath(photoId);
  if (await FileSystem.exists(path)) {
    await FileSystem.unlink(path);
  }
}

export async function clearPhotoBytes(): Promise<void> {
  try {
    if (!(await FileSystem.exists(PHOTO_DIRECTORY))) {
      return;
    }
    const files = await FileSystem.ls(PHOTO_DIRECTORY);
    for (const file of files) {
      await FileSystem.unlink(`${PHOTO_DIRECTORY}/${file}`);
    }
  } catch {
    // The directory may not exist on a fresh install.
  }
}
