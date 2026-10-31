const PHOTO_DIRECTORY = 'photos';

async function photoDirectory(create: boolean): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(PHOTO_DIRECTORY, { create });
}

function fileName(photoId: string): string {
  return `${photoId}.jpg`;
}

export async function savePhotoBytes(photoId: string, blob: Blob): Promise<void> {
  const directory = await photoDirectory(true);
  const handle = await directory.getFileHandle(fileName(photoId), { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function loadPhotoFile(photoId: string): Promise<File | null> {
  try {
    const directory = await photoDirectory(false);
    const handle = await directory.getFileHandle(fileName(photoId));
    return await handle.getFile();
  } catch {
    return null;
  }
}
