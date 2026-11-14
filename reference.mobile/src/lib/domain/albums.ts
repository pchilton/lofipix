import { normalizeNotes } from '@lofipix/db/schema';
import { v7 as uuidv7 } from 'uuid';

import { albumsCollection } from '../db/collections';

function nowIso(): string {
  return new Date().toISOString();
}

export async function createAlbum(
  organizationId: string,
  name: string,
  notes: string,
): Promise<string> {
  const id = uuidv7();
  const now = nowIso();
  albumsCollection.insert({
    id,
    organization_id: organizationId,
    name: name.trim(),
    notes: normalizeNotes(notes),
    version: 0,
    originated_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  return id;
}

export async function updateAlbumNotes(
  albumId: string,
  notes: string,
): Promise<void> {
  const album = albumsCollection.get(albumId);
  if (!album) {
    throw new Error('The album is not available on this device.');
  }
  albumsCollection.update(albumId, (draft) => {
    draft.notes = normalizeNotes(notes);
    draft.updated_at = nowIso();
  });
}

export async function touchAlbum(albumId: string): Promise<void> {
  const album = albumsCollection.get(albumId);
  if (!album) {
    throw new Error('The album is not available on this device.');
  }
  albumsCollection.update(albumId, (draft) => {
    draft.updated_at = nowIso();
  });
}
