import { sha256Hex } from "./hash";

export interface FileHandleLike {
  createWritable(): Promise<WritableLike>;
  getFile(): Promise<Blob>;
}

export interface WritableLike {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

export interface DirectoryEntryLike {
  kind: "file" | "directory";
  name: string;
}

export interface DirectoryHandleLike {
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<DirectoryHandleLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  values?(): AsyncIterable<DirectoryEntryLike>;
}

const PHOTO_DIRECTORY = "photos";

export function photoObjectKey(photoId: string): string {
  return `${PHOTO_DIRECTORY}/${photoId}.jpg`;
}

function requireRoot(): Promise<FileSystemDirectoryHandle> {
  if (!navigator.storage?.getDirectory) {
    throw new Error("Photo storage requires a secure browser context.");
  }
  return navigator.storage.getDirectory();
}

async function photosDirectory(root?: DirectoryHandleLike): Promise<DirectoryHandleLike> {
  const base = root ?? ((await requireRoot()) as unknown as DirectoryHandleLike);
  return base.getDirectoryHandle(PHOTO_DIRECTORY, { create: true });
}

export async function writePhotoFile(
  photoId: string,
  blob: Blob,
  root?: DirectoryHandleLike,
): Promise<{ objectKey: string; checksum: string; size: number }> {
  const directory = await photosDirectory(root);
  const fileName = `${photoId}.jpg`;
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();

  const stored = await fileHandle.getFile();
  const checksum = await sha256Hex(stored);
  const sourceChecksum = await sha256Hex(blob);
  if (checksum !== sourceChecksum || stored.size !== blob.size) {
    await directory.removeEntry(fileName).catch(() => undefined);
    throw new Error("Stored photo did not match the captured bytes.");
  }

  return {
    objectKey: photoObjectKey(photoId),
    checksum,
    size: stored.size,
  };
}

export async function readPhotoFile(
  photoId: string,
  root?: DirectoryHandleLike,
): Promise<Blob | null> {
  try {
    const directory = await photosDirectory(root);
    const fileHandle = await directory.getFileHandle(`${photoId}.jpg`);
    return await fileHandle.getFile();
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") {
      return null;
    }
    throw error;
  }
}

export async function verifyPhotoFile(
  photoId: string,
  checksum: string,
  root?: DirectoryHandleLike,
): Promise<boolean> {
  const blob = await readPhotoFile(photoId, root);
  if (!blob) {
    return false;
  }
  return (await sha256Hex(blob)) === checksum;
}

export async function deletePhotoFile(
  photoId: string,
  root?: DirectoryHandleLike,
): Promise<void> {
  const directory = await photosDirectory(root);
  await directory.removeEntry(`${photoId}.jpg`).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "NotFoundError") {
      return;
    }
    throw error;
  });
}

export async function clearPhotoFiles(root?: DirectoryHandleLike): Promise<void> {
  const base = root ?? ((await requireRoot()) as unknown as DirectoryHandleLike);
  await base.removeEntry(PHOTO_DIRECTORY, { recursive: true }).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "NotFoundError") {
      return;
    }
    throw error;
  });
}
