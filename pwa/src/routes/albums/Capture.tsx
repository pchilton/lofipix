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
import { Link, useParams } from "@tanstack/react-router";
import { useRef, useState } from "react";
import IconArrowLeft from "~icons/lucide/arrow-left";
import IconCamera from "~icons/lucide/camera";
import IconCheck from "~icons/lucide/check";
import IconImagePlus from "~icons/lucide/image-plus";
import IconImages from "~icons/lucide/images";
import IconRefreshCw from "~icons/lucide/refresh-cw";

import { PhotoThumbnail } from "../../components/photos/PhotoThumbnail";
import { RequireSession } from "../../components/RequireSession";
import { SyncBadge } from "../../components/SyncBadge";
import { createPhotoFromBlob } from "../../lib/photos/capture";
import { useAlbum, useAlbumPhotos } from "../../lib/photos/read";
import { captureVideoFrame, useCamera } from "../../lib/photos/use-camera";
import { useSession } from "../../lib/session";

function CameraPanel({
  albumId,
  organizationId,
  onCaptured,
}: {
  albumId: string;
  organizationId: string;
  onCaptured: () => void;
}) {
  const { videoRef, state, start } = useCamera();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCapture, setLastCapture] = useState<string | null>(null);

  async function store(blob: Blob) {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const photo = await createPhotoFromBlob({ albumId, organizationId, blob });
      setLastCapture(photo.id);
      onCaptured();
    } catch (captureError) {
      setError(
        captureError instanceof Error ? captureError.message : "The photo could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border bg-black">
        {state.status === "ready" ? (
          <video
            ref={videoRef}
            className="aspect-[3/4] w-full object-cover sm:aspect-video"
            autoPlay
            muted
            playsInline
          />
        ) : null}

        {state.status === "loading" ? (
          <div className="flex aspect-[3/4] w-full items-center justify-center sm:aspect-video">
            <div className="flex flex-col items-center gap-2 text-sm text-white/80">
              <IconRefreshCw className="size-6 animate-spin" aria-hidden="true" />
              Starting camera…
            </div>
          </div>
        ) : null}

        {state.status !== "ready" && state.status !== "loading" ? (
          <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 p-6 text-center text-white sm:aspect-video">
            <IconCamera className="size-8" aria-hidden="true" />
            <p className="max-w-sm text-sm text-white/80">{state.message}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => void start()}>
                Try again
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/40 bg-transparent text-white hover:bg-white/10"
                onClick={() => fileInput.current?.click()}
              >
                Use camera app
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          type="button"
          size="lg"
          className="rounded-full px-8"
          disabled={state.status !== "ready" || busy}
          onClick={() => {
            const video = videoRef.current;
            if (!video) {
              return;
            }
            void captureVideoFrame(video).then(store).catch((captureError: unknown) => {
              setError(
                captureError instanceof Error
                  ? captureError.message
                  : "The camera frame could not be captured.",
              );
            });
          }}
        >
          <IconCamera aria-hidden="true" />
          {busy ? "Saving…" : "Capture"}
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <IconImagePlus aria-hidden="true" />
          Choose photo
        </Button>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          aria-label="Choose or take a photo"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) {
              void store(file);
            }
          }}
        />
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}

      {lastCapture ? (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <IconCheck className="size-4" aria-hidden="true" />
          Photo saved on this device.
        </p>
      ) : null}
    </div>
  );
}

function CaptureContent() {
  const { albumId } = useParams({ from: "/albums/$albumId/capture" });
  const { profile } = useSession();
  const { album, isLoading, hasError } = useAlbum(albumId);
  const { photos } = useAlbumPhotos(albumId);
  const [captureCount, setCaptureCount] = useState(0);
  const thumbnails = [...photos].reverse().slice(0, 3);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (hasError || !album) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Album not available</CardTitle>
          <CardDescription>
            This album is not stored on this device yet. Return to the dashboard and check the
            sync badge.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/dashboard">Back to albums</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!profile?.organizationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No active organisation</CardTitle>
          <CardDescription>Sign in again with an active organisation.</CardDescription>
        </CardHeader>
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
            <Badge variant="secondary">
              {photos.length} photo{photos.length === 1 ? "" : "s"}
            </Badge>
            {captureCount > 0 ? (
              <span className="ml-2">Saved {captureCount} this session</span>
            ) : null}
          </p>
        </div>
        <SyncBadge />
      </div>

      <CameraPanel
        albumId={albumId}
        organizationId={profile.organizationId}
        onCaptured={() => setCaptureCount((count) => count + 1)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {thumbnails.length === 0 ? (
            <p className="text-sm text-muted-foreground">No photos yet.</p>
          ) : (
            thumbnails.map((photo) => (
              <PhotoThumbnail
                key={photo.id}
                photoId={photo.id}
                alt={`Photo ${photo.position}`}
                className="size-14"
              />
            ))
          )}
        </div>
        <Button asChild>
          <Link to="/albums/$albumId/finish" params={{ albumId }}>
            <IconImages aria-hidden="true" />
            Finish album
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function Capture() {
  return (
    <RequireSession>
      <CaptureContent />
    </RequireSession>
  );
}