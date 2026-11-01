import type { Collection } from '@tanstack/db';
import type { SyncTable } from '@lofipix/db/schema';

export type AnyCollection = Collection<any, string, any, any, any>;

const collections = new Map<SyncTable, AnyCollection>();

export function registerCollection(
  table: SyncTable,
  collection: AnyCollection,
): void {
  collections.set(table, collection);
}

export function getCollection(table: SyncTable): AnyCollection | undefined {
  return collections.get(table);
}
