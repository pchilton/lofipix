import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@lofipix/ui";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import IconCloudOff from "~icons/lucide/cloud-off";
import IconImageOff from "~icons/lucide/image-off";
import IconRefreshCw from "~icons/lucide/refresh-cw";

import { CreateAlbumForm } from "../components/photos/CreateAlbumForm";
import { PhotoThumbnail } from "../components/photos/PhotoThumbnail";
import { RequireSession } from "../components/RequireSession";
import { SyncBadge } from "../components/SyncBadge";
import { useAlbums, useAllPhotos } from "../lib/photos/read";
import { useSession } from "../lib/session";

function AlbumsContent() {
  const { profile, isOffline } = useSession();
  const { albums, isLoading, hasError } = useAlbums();
  const { photos } = useAllPhotos();

  const photoCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const photo of photos) {
      counts.set(photo.albumId, (counts.get(photo.albumId) ?? 0) + 1);
    }
    return counts;
  }, [photos]);

  const albumCovers = useMemo(() => {
    const covers = new Map<string, string>();
    for (const photo of photos) {
      if (!covers.has(photo.albumId)) {
        covers.set(photo.albumId, photo.id);
      }
    }
    return covers;
  }, [photos]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Albums</h1>
          <p className="text-muted-foreground">
            Capture damage photos offline. Changes sync when the network returns.
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
          Offline. Capturing and editing continue on this device.
        </div>
      ) : null}

      <CreateAlbumForm />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
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
              Create your first album above. Albums created in the native app also appear
              here after sync.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {albums.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {albums.map((album) => {
            const count = photoCounts.get(album.id) ?? 0;
            const cover = albumCovers.get(album.id);
            return (
              <li key={album.id}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      {cover ? (
                        <PhotoThumbnail
                          photoId={cover}
                          alt={`${album.name} cover`}
                          className="size-16 shrink-0"
                        />
                      ) : (
                        <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <IconImageOff className="size-5" aria-hidden="true" />
                        </div>
                      )}
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="truncate">{album.name}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {album.notes ?? "No notes"}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                    <Badge variant="secondary">
                      {count} photo{count === 1 ? "" : "s"}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Link
                        className="text-sm underline underline-offset-4"
                        to="/albums/$albumId/capture"
                        params={{ albumId: album.id }}
                      >
                        Take photos
                      </Link>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/albums/$albumId/finish" params={{ albumId: album.id }}>
                          Review
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
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