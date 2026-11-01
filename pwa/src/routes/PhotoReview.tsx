import { createMemo, Show } from 'solid-js';
import { Link, useNavigate, useParams } from '@tanstack/solid-router';
import { deletePhoto } from '../lib/domain/photos';
import { pendingIds } from '../lib/outbox';
import { useLivePhotos } from '../lib/queries';
import ConfirmButton from '../components/confirm-button';
import PhotoThumb from '../components/photo-thumb';
import SyncChip from '../components/sync-chip';

export default function PhotoReview() {
  const params = useParams({ from: '/albums/$albumId/photos/$photoId' });
  const navigate = useNavigate();
  const photos = useLivePhotos();
  const albumPhotos = createMemo(() =>
    photos().filter((photo) => photo.albumId === params().albumId && photo.deletedAt === null),
  );
  const index = () => albumPhotos().findIndex((photo) => photo.id === params().photoId);
  const photo = () => (index() >= 0 ? albumPhotos()[index()] : undefined);
  const previous = () => (index() > 0 ? albumPhotos()[index() - 1] : undefined);
  const next = () => (index() >= 0 && index() < albumPhotos().length - 1 ? albumPhotos()[index() + 1] : undefined);

  return (
    <main class="page">
      <Show
        when={photo()}
        fallback={
          <section>
            <h1>Photo not found</h1>
            <Link to="/albums/$albumId/finish" params={{ albumId: params().albumId }}>
              Back to album
            </Link>
          </section>
        }
      >
        {(current) => (
          <>
            <header class="page-header">
              <Link to="/albums/$albumId/finish" params={{ albumId: params().albumId }}>
                Back to album
              </Link>
              <SyncChip queued={pendingIds().has(current().id)} />
            </header>

            <PhotoThumb photoId={current().id} alt={`Photo ${current().position}`} class="review-image" />

            <dl class="details card">
              <dt>Position</dt>
              <dd>#{current().position}</dd>
              <dt>Dimensions</dt>
              <dd>
                {current().imageWidth} × {current().imageHeight}
              </dd>
              <dt>Size</dt>
              <dd>{Math.round(current().imageSize / 1024)} KB</dd>
              <dt>Captured</dt>
              <dd>{current().capturedAt.toLocaleString()}</dd>
              <dt>Checksum</dt>
              <dd class="mono">{current().imageChecksum?.slice(0, 16) ?? '—'}…</dd>
            </dl>

            <nav class="pager">
              <Show when={previous()} fallback={<span />}>
                {(prev) => (
                  <Link to="/albums/$albumId/photos/$photoId" params={{ albumId: params().albumId, photoId: prev().id }}>
                    Previous
                  </Link>
                )}
              </Show>
              <Show when={next()} fallback={<span />}>
                {(following) => (
                  <Link
                    to="/albums/$albumId/photos/$photoId"
                    params={{ albumId: params().albumId, photoId: following().id }}
                  >
                    Next
                  </Link>
                )}
              </Show>
            </nav>

            <ConfirmButton
              label="Delete photo"
              confirmLabel="Confirm delete"
              onConfirm={async () => {
                await deletePhoto(current().id);
                await navigate({ to: '/albums/$albumId/finish', params: { albumId: params().albumId } });
              }}
            />
          </>
        )}
      </Show>
    </main>
  );
}
