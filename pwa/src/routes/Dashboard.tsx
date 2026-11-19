import { useLiveQuery } from "@tanstack/react-db";
import {
  albumSelectSchema,
  photoSelectSchema,
  type Album,
  type Photo,
} from "@lofipix/db/schema";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@lofipix/ui";
import { useMemo } from "react";
import IconCloudOff from "~icons/lucide/cloud-off";
import IconImageOff from "~icons/lucide/image-off";
import IconRefreshCw from "~icons/lucide/refresh-cw";

import { RequireSession } from "../components/RequireSession";
import { SyncBadge } from "../components/SyncBadge";
import { albumsCollection, photosCollection } from "../lib/db/collections";
import type { AlbumRow, PhotoRow } from "../lib/db/schema";
import { useSession } from "../lib/session";

function dateValue(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

function toAlbum(row: AlbumRow): Album | null {
  const parsed = albumSelectSchema.safeParse({
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    notes: row.notes,
    version: row.version,
    originatedAt: dateValue(row.originated_at),
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
    deletedAt: dateValue(row.deleted_at),
  });
  return parsed.success ? parsed.data : null;
}

function toPhoto(row: PhotoRow): Photo | null {
  const parsed = photoSelectSchema.safeParse({
    id: row.id,
    albumId: row.album_id,
    position: row.position,
    imageWidth: row.image_width,
    imageHeight: row.image_height,
    imageQuality: row.image_quality,
    imageSize: row.image_size,
    imageChecksum: row.image_checksum,
    version: row.version,
    originatedAt: dateValue(row.originated_at),
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
    deletedAt: dateValue(row.deleted_at),
  });
  return parsed.success ? parsed.data : null;
}

function AlbumsContent() {
  const { profile, isOffline } = useSession();
  const albumQuery = useLiveQuery((q) => q.from({ albums: albumsCollection }));
  const photoQuery = useLiveQuery((q) => q.from({ photos: photosCollection }));

  const albums = useMemo(() => {
    const rows = (albumQuery.data ?? []) as AlbumRow[];
    return rows
      .map(toAlbum)
      .filter((album): album is Album => album !== null && album.deletedAt === null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [albumQuery.data]);

  const photoCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of (photoQuery.data ?? []) as PhotoRow[]) {
      const photo = toPhoto(row);
      if (!photo || photo.deletedAt !== null) {
        continue;
      }
      counts.set(photo.albumId, (counts.get(photo.albumId) ?? 0) + 1);
    }
    return counts;
  }, [photoQuery.data]);

  const isLoading = albumQuery.isLoading || photoQuery.isLoading;
  const hasError = albumQuery.isLoadingError || photoQuery.isLoadingError;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Albums</h1>
          <p className="text-muted-foreground">
            Albums sync from your organisation. Capturing new photos arrives in the next task.
          </p>
          {profile?.organizationId ? (
            <p className="text-xs text-muted-foreground">
              Organisation {profile.organizationId}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              No active organisation on this session.
            </p>
          )}
        </div>
        <SyncBadge />
      </div>

      {isOffline ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-sm">
          <IconCloudOff className="size-4" aria-hidden="true" />
          Offline. Showing the albums stored on this device.
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : null}

      {hasError ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconRefreshCw className="size-4" aria-hidden="true" />
              Local data could not be read
            </CardTitle>
            <CardDescription>
              The PowerSync database is not ready. Check the sync badge for details.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!isLoading && !hasError && albums.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconImageOff className="size-4" aria-hidden="true" />
              No albums yet
            </CardTitle>
            <CardDescription>
              Albums created in the native app appear here after the first sync. Creating
              albums in the PWA is part of the capture task.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>
              Create album soon
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {albums.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {albums.map((album) => (
            <li key={album.id}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{album.name}</CardTitle>
                  <CardDescription>
                    {album.notes ?? "No notes"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {photoCounts.get(album.id) ?? 0} photo
                    {(photoCounts.get(album.id) ?? 0) === 1 ? "" : "s"}
                  </span>
                  <span>{album.createdAt.toLocaleDateString()}</span>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function Dashboard() {
  return (
    <RequireSession>
      <AlbumsContent />
    </RequireSession>
  );
}
