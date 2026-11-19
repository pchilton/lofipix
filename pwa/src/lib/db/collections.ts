import { createCollection } from "@tanstack/react-db";
import { powerSyncCollectionOptions } from "@tanstack/powersync-db-collection";

import { powersync } from "./powersync";
import { AppSchema } from "./schema";

export const albumsCollection = createCollection(
  powerSyncCollectionOptions({
    database: powersync,
    table: AppSchema.props.albums,
  }),
);

export const photosCollection = createCollection(
  powerSyncCollectionOptions({
    database: powersync,
    table: AppSchema.props.photos,
  }),
);

export const photoLocationsCollection = createCollection(
  powerSyncCollectionOptions({
    database: powersync,
    table: AppSchema.props.photo_locations,
  }),
);

export const storageProvidersCollection = createCollection(
  powerSyncCollectionOptions({
    database: powersync,
    table: AppSchema.props.storage_providers,
  }),
);
