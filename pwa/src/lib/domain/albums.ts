import { normalizeNotes } from '@lofipix/db/schema';
import { v7 as uuidv7 } from 'uuid';
import { getAlbumsCollection } from '../db/collections';
import { persistWrite } from '../db/persist';

export async function createAlbum(
  organizationId: string,
  name: string,
  notes: string,
): Promise<string> {
  const id = uuidv7();
  const now = new Date();
  const transaction = getAlbumsCollection().insert({
    id,
    organizationId,
    name: name.trim(),
    notes: normalizeNotes(notes),
    version: 0,
    outboxNeeded: true,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  await persistWrite(transaction);
  return id;
}

export async function updateAlbumNotes(
  albumId: string,
  notes: string,
): Promise<void> {
  const transaction = getAlbumsCollection().update(albumId, (draft) => {
    draft.notes = normalizeNotes(notes);
    draft.outboxNeeded = true;
    draft.updatedAt = new Date();
  });
  await persistWrite(transaction);
}

export async function touchAlbum(albumId: string): Promise<void> {
  const transaction = getAlbumsCollection().update(albumId, (draft) => {
    draft.outboxNeeded = true;
    draft.updatedAt = new Date();
  });
  await persistWrite(transaction);
}
