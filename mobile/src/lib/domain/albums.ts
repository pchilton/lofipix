import { eq } from 'drizzle-orm';
import { normalizeNotes } from '@lofipix/db/schema';
import { v7 as uuidv7 } from 'uuid';

import { getDb } from '../db/client';
import { albums } from '../db/schema';
import { queueInsert, queueUpdate } from '../outbox';
import { bumpRevision } from '../revision';

export async function createAlbum(
  organizationId: string,
  name: string,
  notes: string,
): Promise<string> {
  const id = uuidv7();
  const now = new Date();
  const row = {
    id,
    organizationId,
    name: name.trim(),
    notes: normalizeNotes(notes),
    version: 0,
    outboxNeeded: true,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await getDb().insert(albums).values(row);
  queueInsert('albums', row);
  bumpRevision();
  return id;
}

export async function updateAlbumNotes(albumId: string, notes: string): Promise<void> {
  const [original] = await getDb().select().from(albums).where(eq(albums.id, albumId)).limit(1);
  if (!original) {
    throw new Error('The album is not available on this device.');
  }
  const changes = {
    notes: normalizeNotes(notes),
    outboxNeeded: true,
    updatedAt: new Date(),
  };
  await getDb().update(albums).set(changes).where(eq(albums.id, albumId));
  queueUpdate('albums', original, changes);
  bumpRevision();
}

export async function touchAlbum(albumId: string): Promise<void> {
  const [original] = await getDb().select().from(albums).where(eq(albums.id, albumId)).limit(1);
  if (!original) {
    throw new Error('The album is not available on this device.');
  }
  const changes = { outboxNeeded: true, updatedAt: new Date() };
  await getDb().update(albums).set(changes).where(eq(albums.id, albumId));
  queueUpdate('albums', original, changes);
  bumpRevision();
}

export async function listAlbums() {
  return getDb().select().from(albums);
}
