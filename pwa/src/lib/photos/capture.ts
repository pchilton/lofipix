import { normalizeNotes } from "@lofipix/db/schema";
import { v7 as uuidv7 } from "uuid";

import { powersync } from "../db/powersync";
import { connectPowerSync } from "../db/sync";
import { compressImage } from "./compress";
import { ensureOpfsProvider } from "./device";
import { sha256Hex } from "./hash";
import { deletePhotoFile, writePhotoFile } from "./opfs";
import { buildPhotoLocationRow, buildPhotoRow } from "./rows";

export class DuplicateAlbumError extends Error {
  readonly albumId: string;

  constructor(albumId: string) {
    super("An album with this name already exists.");
    this.name = "DuplicateAlbumError";
    this.albumId = albumId;
  }
}

export interface NewAlbumInput {
  organizationId: string;
  name: string;
  notes: string;
}

export async function findAlbumByName(
  organizationId: string,
  name: string,
): Promise<string | null> {
  const row = await powersync.getOptional<{ id: string }>(
    `SELECT id FROM albums
     WHERE organization_id = ? AND deleted_at IS NULL
       AND lower(trim(name)) = lower(trim(?))
     LIMIT 1`,
    [organizationId, name],
  );
  return row?.id ?? null;
}

export async function createAlbum(input: NewAlbumInput): Promise<string> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Album name is required.");
  }
  const existing = await findAlbumByName(input.organizationId, name);
  if (existing) {
    throw new DuplicateAlbumError(existing);
  }

  const id = uuidv7();
  const now = new Date().toISOString();
  await powersync.execute(
    `INSERT INTO albums (
       id, organization_id, name, notes, version,
       originated_at, created_at, updated_at, deleted_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.organizationId,
      name,
      normalizeNotes(input.notes),
      1,
      now,
      now,
      null,
      null,
    ],
  );
  void connectPowerSync().catch(() => undefined);
  return id;
}

export async function updateAlbumNotes(albumId: string, notes: string): Promise<void> {
  await powersync.execute(
    `UPDATE albums SET notes = ?, updated_at = ? WHERE id = ?`,
    [normalizeNotes(notes), new Date().toISOString(), albumId],
  );
  void connectPowerSync().catch(() => undefined);
}

async function nextPosition(albumId: string): Promise<number> {
  const row = await powersync.getOptional<{ position: number | null }>(
    `SELECT MAX(position) AS position FROM photos WHERE album_id = ?`,
    [albumId],
  );
  return (row?.position ?? 0) + 1;
}

export interface CreatePhotoInput {
  albumId: string;
  organizationId: string;
  blob: Blob;
}

export interface CreatedPhoto {
  id: string;
  objectKey: string;
  checksum: string;
  size: number;
  width: number;
  height: number;
  quality: number;
}

export async function createPhotoFromBlob(input: CreatePhotoInput): Promise<CreatedPhoto> {
  const album = await powersync.getOptional<{ id: string; deleted_at: string | null }>(
    `SELECT id, deleted_at FROM albums WHERE id = ? AND organization_id = ?`,
    [input.albumId, input.organizationId],
  );
  if (!album || album.deleted_at) {
    throw new Error("Album is not available on this device.");
  }

  const compressed = await compressImage(input.blob);
  const photoId = uuidv7();
  const locationId = uuidv7();
  const providerId = await ensureOpfsProvider(input.organizationId);
  const checksum = await sha256Hex(compressed.blob);
  const stored = await writePhotoFile(photoId, compressed.blob);
  const position = await nextPosition(input.albumId);
  const originatedAt = new Date();

  const photo = buildPhotoRow({
    id: photoId,
    albumId: input.albumId,
    position,
    width: compressed.width,
    height: compressed.height,
    quality: compressed.quality,
    size: stored.size,
    checksum,
    originatedAt,
  });
  const location = buildPhotoLocationRow({
    id: locationId,
    photoId,
    storageProviderId: providerId,
    objectKey: stored.objectKey,
    originatedAt,
  });

  try {
    await powersync.writeTransaction(async (tx) => {
      await tx.execute(
        `INSERT INTO photos (
           id, album_id, position, image_width, image_height, image_quality,
           image_size, image_checksum, version, originated_at, created_at,
           updated_at, deleted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          photo.id,
          photo.album_id,
          photo.position,
          photo.image_width,
          photo.image_height,
          photo.image_quality,
          photo.image_size,
          photo.image_checksum,
          photo.version,
          photo.originated_at,
          photo.created_at,
          photo.updated_at,
          photo.deleted_at,
        ],
      );
      await tx.execute(
        `INSERT INTO photo_locations (
           id, photo_id, storage_provider_id, object_key, version,
           originated_at, created_at, updated_at, deleted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          location.id,
          location.photo_id,
          location.storage_provider_id,
          location.object_key,
          location.version,
          location.originated_at,
          location.created_at,
          location.updated_at,
          location.deleted_at,
        ],
      );
    });
  } catch (error) {
    await deletePhotoFile(photoId).catch(() => undefined);
    throw error;
  }

  void connectPowerSync().catch(() => undefined);

  return {
    id: photoId,
    objectKey: stored.objectKey,
    checksum: stored.checksum,
    size: stored.size,
    width: compressed.width,
    height: compressed.height,
    quality: compressed.quality,
  };
}

export async function deletePhoto(photoId: string): Promise<void> {
  await powersync.writeTransaction(async (tx) => {
    await tx.execute(`DELETE FROM photo_locations WHERE photo_id = ?`, [photoId]);
    await tx.execute(`DELETE FROM photos WHERE id = ?`, [photoId]);
  });
  await deletePhotoFile(photoId);
  void connectPowerSync().catch(() => undefined);
}