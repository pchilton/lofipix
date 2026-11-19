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
import { useEffect, useState } from "react";
import IconArrowLeft from "~icons/lucide/arrow-left";
import IconCloudOff from "~icons/lucide/cloud-off";
import IconImageOff from "~icons/lucide/image-off";
import IconImagePlus from "~icons/lucide/image-plus";
import IconTrash2 from "~icons/lucide/trash-2";

import { PhotoThumbnail } from "../../components/photos/PhotoThumbnail";
import { RequireSession } from "../../components/RequireSession";
import { SyncBadge } from "../../components/SyncBadge";
import { Textarea } from "../../components/Textarea";
import { deletePhoto, updateAlbumNotes } from "../../lib/photos/capture";
import { useAlbum, useAlbumPhotos } from "../../lib/photos/read";
import { useSyncState } from "../../lib/db/sync-state";
import { useSession } from "../../lib/session";

function PhotoStatus({ phase }: { phase: ReturnType<typeof useSyncState>["phase"] }) {
  if (phase === "synced") {
    return <Badge>Synced</Badge>;
  }
  if (phase === "syncing" || phase === "connecting" || phase === "loading") {
    return <Badge variant="secondary">Queued</Badge>;
  }
  return <Badge variant="outline">Device-only</Badge>;
}

function FinishContent() {
  const { albumId } = useParams({ from: "/albums/$albumId/finish" });
  const navigate = useNavigate();
  const { isOffline } = useSession();
  const { album, isLoading, hasError } = useAlbum(albumId);
  const { photos } = useAlbumPhotos(albumId);
  const sync = useSyncState();
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesState, setNotesState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    if (album) {
      setNotes(album.notes ?? "");
      setNotesDirty(false);
      setNotesState("idle");
    }
  }, [album?.id]);

  async function saveNotes(): Promise<boolean> {
    if (!album) {
      return false;
    }
    setNotesState("saving");
    setError(null);
    try {
      await updateAlbumNotes(album.id, notes);
      setNotesDirty(false);
      setNotesState("saved");
      return true;
    } catch (saveError) {
      setNotesState("idle");
      setError(saveError instanceof Error ? saveError.message : "Notes could not be saved.");
      return false;
    }
  }

  async function remove(photoId: string) {
    setPendingDelete(photoId);
    setError(null);
    try {
      await deletePhoto(photoId);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "The photo could not be deleted.",
      );
    } finally {
      setPendingDelete(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (hasError || !album) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Album not available</CardTitle>
          <CardDescription>Return to the dashboard and check the sync badge.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/dashboard">Back to albums</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link to="/dashboard">
              <IconArrowLeft aria-hidden="true" />
              Albums
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{album.name}</h1>
          <p className="text-sm text-muted-foreground">
            Review photos and notes before submitting.
          </p>
        </div>
        <SyncBadge />
      </div>

      {isOffline ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-sm">
          <IconCloudOff className="size-4" aria-hidden="true" />
          Offline. Review and deletion work on this device; changes sync later.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>
            Paragraphs are separated by a single blank line. Empty notes are stored as no
            notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={notes}
            aria-label="Album notes"
            onChange={(event) => {
              setNotes(event.currentTarget.value);
              setNotesDirty(true);
              setNotesState("idle");
            }}
          />
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!notesDirty || notesState === "saving"}
              onClick={() => void saveNotes()}
            >
              {notesState === "saving" ? "Saving…" : "Save notes"}
            </Button>
            {notesState === "saved" ? (
              <span className="text-sm text-muted-foreground">Saved on this device.</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">
            Photos ({photos.length})
          </h2>
          <PhotoStatus phase={sync.phase} />
        </div>
        <Button asChild variant="outline">
          <Link to="/albums/$albumId/capture" params={{ albumId }}>
            <IconImagePlus aria-hidden="true" />
            Add photos
          </Link>
        </Button>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}

      {photos.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconImageOff className="size-4" aria-hidden="true" />
              No photos yet
            </CardTitle>
            <CardDescription>Add photos to review them here.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/albums/$albumId/capture" params={{ albumId }}>
                Take photos
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {photos.map((photo) => (
            <li key={photo.id}>
              <Card className="h-full overflow-hidden">
                <Link
                  to="/albums/$albumId/photos/$photoId"
                  params={{ albumId, photoId: photo.id }}
                  className="block"
                >
                  <PhotoThumbnail
                    photoId={photo.id}
                    alt={`Photo ${photo.position}`}
                    className="aspect-square w-full rounded-none"
                  />
                </Link>
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">#{photo.position}</span>
                    <PhotoStatus phase={sync.phase} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {photo.imageWidth}×{photo.imageHeight} ·{" "}
                    {Math.max(1, Math.round(photo.imageSize / 1024))} KB
                  </p>
                  <div className="flex items-center justify-between">
                    <Button asChild variant="ghost" size="sm">
                      <Link
                        to="/albums/$albumId/photos/$photoId"
                        params={{ albumId, photoId: photo.id }}
                      >
                        Review
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete photo ${photo.position}`}
                          disabled={pendingDelete === photo.id}
                        >
                          <IconTrash2 aria-hidden="true" />
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
                          <AlertDialogAction onClick={() => void remove(photo.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
        <Button asChild variant="outline">
          <Link to="/dashboard">Back to albums</Link>
        </Button>
        <Button
          type="button"
          disabled={notesState === "saving"}
          onClick={() => {
            if (!notesDirty) {
              void navigate({ to: "/dashboard" });
              return;
            }
            void saveNotes().then((saved) => {
              if (saved) {
                void navigate({ to: "/dashboard" });
              }
            });
          }}
        >
          Submit album
        </Button>
      </div>
    </div>
  );
}

export default function FinishAlbum() {
  return (
    <RequireSession>
      <FinishContent />
    </RequireSession>
  );
}