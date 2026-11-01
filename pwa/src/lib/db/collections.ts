import { createCollection } from '@tanstack/solid-db';
import { drizzleCollectionOptions } from 'tanstack-db-pglite';
import type { SyncTable } from '@lofipix/db/schema';
import { getDb } from './client';
import { albums, photoLocations, photos, storageProviders } from './schema';
import { electricSync } from '../electric-sync';
import { queueDelete, queueInsert, queueUpdate } from '../outbox';
import { registerCollection } from './registry';

type MutationParams = {
  transaction: {
    when: (state: 'settled') => Promise<{ state: string }>;
    mutations: ReadonlyArray<{
      modified?: Record<string, unknown>;
      original?: Record<string, unknown>;
      changes?: Record<string, unknown>;
    }>;
  };
};

function afterCommit(params: MutationParams, work: () => void): void {
  void params.transaction
    .when('settled')
    .then((settled) => {
      if (settled.state !== 'completed') {
        return;
      }
      window.setTimeout(work, 0);
    })
    .catch((error: unknown) => {
      console.error('Could not queue the local change:', error);
    });
}

function createAlbums() {
  return createCollection(
    drizzleCollectionOptions({
      db: getDb(),
      table: albums,
      primaryColumn: albums.id,
      startSync: false,
      sync: {
        rowUpdateMode: 'partial',
        sync: (params) => electricSync('albums', params as never),
      },
      onInsert: async (params) => {
        afterCommit(params as unknown as MutationParams, () => {
          for (const mutation of (params as unknown as MutationParams).transaction.mutations) {
            queueInsert('albums', mutation.modified ?? {});
          }
        });
      },
      onUpdate: async (params) => {
        afterCommit(params as unknown as MutationParams, () => {
          for (const mutation of (params as unknown as MutationParams).transaction.mutations) {
            queueUpdate('albums', mutation.original ?? {}, mutation.changes ?? {});
          }
        });
      },
      onDelete: async (params) => {
        afterCommit(params as unknown as MutationParams, () => {
          for (const mutation of (params as unknown as MutationParams).transaction.mutations) {
            if (mutation.original?.outboxNeeded === true) {
              queueDelete('albums', mutation.original);
            }
          }
        });
      },
    }),
  );
}

function createPhotos() {
  return createCollection(
    drizzleCollectionOptions({
      db: getDb(),
      table: photos,
      primaryColumn: photos.id,
      startSync: false,
      sync: {
        rowUpdateMode: 'partial',
        sync: (params) => electricSync('photos', params as never),
      },
      onInsert: async (params) => {
        afterCommit(params as unknown as MutationParams, () => {
          for (const mutation of (params as unknown as MutationParams).transaction.mutations) {
            queueInsert('photos', mutation.modified ?? {});
          }
        });
      },
      onUpdate: async (params) => {
        afterCommit(params as unknown as MutationParams, () => {
          for (const mutation of (params as unknown as MutationParams).transaction.mutations) {
            queueUpdate('photos', mutation.original ?? {}, mutation.changes ?? {});
          }
        });
      },
      onDelete: async (params) => {
        afterCommit(params as unknown as MutationParams, () => {
          for (const mutation of (params as unknown as MutationParams).transaction.mutations) {
            if (mutation.original?.outboxNeeded === true) {
              queueDelete('photos', mutation.original);
            }
          }
        });
      },
    }),
  );
}

function createPhotoLocations() {
  return createCollection(
    drizzleCollectionOptions({
      db: getDb(),
      table: photoLocations,
      primaryColumn: photoLocations.id,
      startSync: false,
      sync: {
        rowUpdateMode: 'partial',
        sync: (params) => electricSync('photo_locations', params as never),
      },
      onInsert: async (params) => {
        afterCommit(params as unknown as MutationParams, () => {
          for (const mutation of (params as unknown as MutationParams).transaction.mutations) {
            queueInsert('photo_locations', mutation.modified ?? {});
          }
        });
      },
      onUpdate: async (params) => {
        afterCommit(params as unknown as MutationParams, () => {
          for (const mutation of (params as unknown as MutationParams).transaction.mutations) {
            queueUpdate('photo_locations', mutation.original ?? {}, mutation.changes ?? {});
          }
        });
      },
      onDelete: async (params) => {
        afterCommit(params as unknown as MutationParams, () => {
          for (const mutation of (params as unknown as MutationParams).transaction.mutations) {
            if (mutation.original?.outboxNeeded === true) {
              queueDelete('photo_locations', mutation.original);
            }
          }
        });
      },
    }),
  );
}

function createStorageProviders() {
  return createCollection(
    drizzleCollectionOptions({
      db: getDb(),
      table: storageProviders,
      primaryColumn: storageProviders.id,
      startSync: false,
      sync: {
        rowUpdateMode: 'partial',
        sync: (params) => electricSync('storage_providers', params as never),
      },
      onInsert: async (params) => {
        afterCommit(params as unknown as MutationParams, () => {
          for (const mutation of (params as unknown as MutationParams).transaction.mutations) {
            queueInsert('storage_providers', mutation.modified ?? {});
          }
        });
      },
      onUpdate: async (params) => {
        afterCommit(params as unknown as MutationParams, () => {
          for (const mutation of (params as unknown as MutationParams).transaction.mutations) {
            queueUpdate('storage_providers', mutation.original ?? {}, mutation.changes ?? {});
          }
        });
      },
      onDelete: async (params) => {
        afterCommit(params as unknown as MutationParams, () => {
          for (const mutation of (params as unknown as MutationParams).transaction.mutations) {
            if (mutation.original?.outboxNeeded === true) {
              queueDelete('storage_providers', mutation.original);
            }
          }
        });
      },
    }),
  );
}

type AlbumsCollection = ReturnType<typeof createAlbums>;
type PhotosCollection = ReturnType<typeof createPhotos>;
type PhotoLocationsCollection = ReturnType<typeof createPhotoLocations>;
type StorageProvidersCollection = ReturnType<typeof createStorageProviders>;

let albumsCollection: AlbumsCollection | undefined;
let photosCollection: PhotosCollection | undefined;
let photoLocationsCollection: PhotoLocationsCollection | undefined;
let storageProvidersCollection: StorageProvidersCollection | undefined;

export function initCollections(): void {
  if (albumsCollection) {
    return;
  }
  albumsCollection = createAlbums();
  photosCollection = createPhotos();
  photoLocationsCollection = createPhotoLocations();
  storageProvidersCollection = createStorageProviders();

  registerCollection('albums', albumsCollection as never);
  registerCollection('photos', photosCollection as never);
  registerCollection('photo_locations', photoLocationsCollection as never);
  registerCollection('storage_providers', storageProvidersCollection as never);
}

function collectionFor(table: SyncTable) {
  switch (table) {
    case 'albums':
      return albumsCollection;
    case 'photos':
      return photosCollection;
    case 'photo_locations':
      return photoLocationsCollection;
    case 'storage_providers':
      return storageProvidersCollection;
  }
}

export async function startCollectionSync(): Promise<void> {
  initCollections();
  for (const table of [
    'albums',
    'photos',
    'photo_locations',
    'storage_providers',
  ] as const) {
    const collection = collectionFor(table);
    try {
      await collection?.utils.runSync();
    } catch (error) {
      console.error(`Could not start the ${table} shape:`, error);
    }
  }
}

export function getAlbumsCollection(): AlbumsCollection {
  if (!albumsCollection) {
    throw new Error('Collections have not been initialised.');
  }
  return albumsCollection;
}

export function getPhotosCollection(): PhotosCollection {
  if (!photosCollection) {
    throw new Error('Collections have not been initialised.');
  }
  return photosCollection;
}

export function getPhotoLocationsCollection(): PhotoLocationsCollection {
  if (!photoLocationsCollection) {
    throw new Error('Collections have not been initialised.');
  }
  return photoLocationsCollection;
}

export function getStorageProvidersCollection(): StorageProvidersCollection {
  if (!storageProvidersCollection) {
    throw new Error('Collections have not been initialised.');
  }
  return storageProvidersCollection;
}
