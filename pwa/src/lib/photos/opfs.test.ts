import { beforeEach, describe, expect, it } from "vitest";

import { sha256Hex } from "./hash";
import {
  clearPhotoFiles,
  deletePhotoFile,
  type DirectoryEntryLike,
  type DirectoryHandleLike,
  type FileHandleLike,
  photoObjectKey,
  readPhotoFile,
  verifyPhotoFile,
  writePhotoFile,
  type WritableLike,
} from "./opfs";

class MemoryFileHandle implements FileHandleLike {
  private blob = new Blob([]);

  async createWritable(): Promise<WritableLike> {
    const chunks: Blob[] = [];
    return {
      write: async (data: Blob) => {
        chunks.push(data);
      },
      close: async () => {
        this.blob = new Blob(chunks);
      },
    };
  }

  async getFile(): Promise<Blob> {
    return this.blob;
  }
}

class MemoryDirectoryHandle implements DirectoryHandleLike {
  readonly files = new Map<string, MemoryFileHandle>();
  readonly directories = new Map<string, MemoryDirectoryHandle>();

  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<MemoryDirectoryHandle> {
    const existing = this.directories.get(name);
    if (existing) {
      return existing;
    }
    if (!options?.create) {
      throw new DOMException(`${name} not found`, "NotFoundError");
    }
    const directory = new MemoryDirectoryHandle();
    this.directories.set(name, directory);
    return directory;
  }

  async getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<MemoryFileHandle> {
    const existing = this.files.get(name);
    if (existing) {
      return existing;
    }
    if (!options?.create) {
      throw new DOMException(`${name} not found`, "NotFoundError");
    }
    const file = new MemoryFileHandle();
    this.files.set(name, file);
    return file;
  }

  async removeEntry(name: string, options?: { recursive?: boolean }): Promise<void> {
    if (this.files.delete(name)) {
      return;
    }
    if (this.directories.has(name)) {
      if (!options?.recursive) {
        throw new DOMException(`${name} is a directory`, "TypeMismatchError");
      }
      this.directories.delete(name);
      return;
    }
    throw new DOMException(`${name} not found`, "NotFoundError");
  }

  async *values(): AsyncIterable<DirectoryEntryLike> {
    for (const name of this.files.keys()) {
      yield { kind: "file", name };
    }
    for (const name of this.directories.keys()) {
      yield { kind: "directory", name };
    }
  }
}

describe("OPFS photo storage", () => {
  let root: MemoryDirectoryHandle;

  beforeEach(() => {
    root = new MemoryDirectoryHandle();
  });

  it("builds the documented object key", () => {
    expect(photoObjectKey("01912345-6789-7abc-8def-0123456789ab")).toBe(
      "photos/01912345-6789-7abc-8def-0123456789ab.jpg",
    );
  });

  it("writes, reads back and verifies the stored bytes", async () => {
    const blob = new Blob([new TextEncoder().encode("photo-bytes")]);
    const stored = await writePhotoFile("photo-1", blob, root);

    expect(stored.objectKey).toBe("photos/photo-1.jpg");
    expect(stored.size).toBe(blob.size);
    expect(stored.checksum).toBe(await sha256Hex(blob));

    const read = await readPhotoFile("photo-1", root);
    expect(read).not.toBeNull();
    expect(await sha256Hex(read as Blob)).toBe(stored.checksum);
    await expect(verifyPhotoFile("photo-1", stored.checksum, root)).resolves.toBe(true);
    await expect(verifyPhotoFile("photo-1", "0".repeat(64), root)).resolves.toBe(false);
  });

  it("removes a photo and reports a missing file", async () => {
    await writePhotoFile("photo-1", new Blob(["bytes"]), root);
    await deletePhotoFile("photo-1", root);
    await expect(readPhotoFile("photo-1", root)).resolves.toBeNull();
    await expect(deletePhotoFile("photo-1", root)).resolves.toBeUndefined();
  });

  it("clears the photo directory", async () => {
    await writePhotoFile("photo-1", new Blob(["one"]), root);
    await writePhotoFile("photo-2", new Blob(["two"]), root);
    await clearPhotoFiles(root);
    await expect(readPhotoFile("photo-1", root)).resolves.toBeNull();
    await expect(readPhotoFile("photo-2", root)).resolves.toBeNull();
    await expect(clearPhotoFiles(root)).resolves.toBeUndefined();
  });
});