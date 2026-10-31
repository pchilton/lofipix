import { normalizeNotes } from '@lofipix/db/schema';
import { v7 as uuidv7 } from 'uuid';
import { albumsCollection, persistWrite } from '../powersync/collections';

export async function createAlbum(organizationId: string, name: string, notes: string): Promise<string> {
  const id = uuidv7();
  const now = new Date();
  const transaction = albumsCollection.insert({
    id,
    organization_id: organizationId,
    name: name.trim(),
    notes: normalizeNotes(notes),
    deleted_at: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
  await persistWrite(transaction);
  return id;
}

export async function updateAlbumNotes(albumId: string, notes: string): Promise<void> {
  const transaction = albumsCollection.update(albumId, (draft) => {
    draft.notes = normalizeNotes(notes);
    draft.updated_at = new Date().toISOString();
  });
  await persistWrite(transaction);
}

export async function touchAlbum(albumId: string): Promise<void> {
  const transaction = albumsCollection.update(albumId, (draft) => {
    draft.updated_at = new Date().toISOString();
  });
  await persistWrite(transaction);
}
