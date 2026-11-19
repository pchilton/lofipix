import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@lofipix/ui";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import IconArrowLeft from "~icons/lucide/arrow-left";
import IconChevronLeft from "~icons/lucide/chevron-left";
import IconChevronRight from "~icons/lucide/chevron-right";
import IconImageOff from "~icons/lucide/image-off";
import IconTrash2 from "~icons/lucide/trash-2";

import { RequireSession } from "../../components/RequireSession";
import { SyncBadge } from "../../components/SyncBadge";
import { useSyncState } from "../../lib/db/sync-state";
import { deletePhoto } from "../../lib/photos/capture";
import { usePhoto } from "../../lib/photos/read";
import { usePhotoUrl } from "../../lib/photos/use-photo-url";

function PhotoReviewContent() {
  const { albumId, photoId } = useParams({ from: "/albums/$albumId/photos/$photoId" });
  const navigate = useNavigate();
  const { photo, photos, isLoading, hasError } = usePhoto(albumId, photoId);
  const url = usePhotoUrl(photoId);
  const sync = useSyncState();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (hasError || !photo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconImageOff className="size-4" aria-hidden="true" />
            Photo not available
          </CardTitle>
          <CardDescription>
            The photo may have been deleted, or its row has not synced to this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/albums/$albumId/finish" params={{ albumId }}>
              Back to album
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const index = photos.findIndex((item) => item.id === photo.id);
  const previous = index > 0 ? photos[index - 1] : null;
  const next = index >= 0 && index < photos.length - 1 ? photos[index + 1] : null;

  async function remove() {
    if (!photo) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await deletePhoto(photo.id);
      await navigate({ to: "/albums/$albumId/finish", params: { albumId } });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "The photo could not be deleted.",
      );
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link to="/albums/$albumId/finish" params={{ albumId }}>
              <IconArrowLeft aria-hidden="true" />
              Album
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Photo #{photo.position}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={sync.phase === "synced" ? "default" : "secondary"}>
              {sync.phase === "synced" ? "Synced" : "Device-only / queued"}
            </Badge>
            <span>
              {photo.imageWidth}×{photo.imageHeight} ·{" "}
              {Math.max(1, Math.round(photo.imageSize / 1024))} KB · q{photo.imageQuality}
            </span>
          </div>
        </div>
        <SyncBadge />
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-black">
        {url ? (
          <img src={url} alt={`Photo ${photo.position}`} className="max-h-[70vh] w-full object-contain" />
        ) : (
          <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 text-sm text-white/80">
            <IconImageOff className="size-8" aria-hidden="true" />
            This photo is not stored on this browser.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {previous ? (
            <Button asChild variant="outline">
              <Link
                to="/albums/$albumId/photos/$photoId"
                params={{ albumId, photoId: previous.id }}
              >
                <IconChevronLeft aria-hidden="true" />
                Previous
              </Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              <IconChevronLeft aria-hidden="true" />
              Previous
            </Button>
          )}
          {next ? (
            <Button asChild variant="outline">
              <Link to="/albums/$albumId/photos/$photoId" params={{ albumId, photoId: next.id }}>
                Next
                <IconChevronRight aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Next
              <IconChevronRight aria-hidden="true" />
            </Button>
          )}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" disabled={pending}>
              <IconTrash2 aria-hidden="true" />
              Delete photo
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
              <AlertDialogDescription>
                The local file is removed and the deletion syncs to other devices.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void remove()}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export default function PhotoReview() {
  return (
    <RequireSession>
      <PhotoReviewContent />
    </RequireSession>
  );
}