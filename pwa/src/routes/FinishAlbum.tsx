import { createMemo, createSignal, For, Show } from 'solid-js';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/solid-router';
import { createForm, useStore } from '@tanstack/solid-form';
import { z } from 'zod';
import { deletePhoto } from '../lib/domain/photos';
import { touchAlbum, updateAlbumNotes } from '../lib/domain/albums';
import { errorText } from '../lib/form';
import { pendingIds } from '../lib/outbox';
import { useLiveAlbums, useLivePhotos } from '../lib/queries';
import ConfirmButton from '../components/confirm-button';
import PhotoThumb from '../components/photo-thumb';
import SyncChip from '../components/sync-chip';

const notesSchema = z.string().max(2000, 'Keep notes under 2000 characters.');

export default function FinishAlbum() {
  const params = useParams({ from: '/albums/$albumId/finish' });
  const search = useSearch({ from: '/albums/$albumId/finish' });
  const navigate = useNavigate();
  const albums = useLiveAlbums();
  const photos = useLivePhotos();
  const album = () => albums().find((candidate) => candidate.id === params().albumId);
  const albumPhotos = createMemo(() =>
    photos().filter((photo) => photo.albumId === params().albumId && photo.deletedAt === null),
  );
  const [error, setError] = createSignal<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await touchAlbum(params().albumId);
      await navigate({ to: '/' });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not submit the album.');
    }
  }

  return (
    <main class="page">
      <Show
        when={album()}
        fallback={
          <section>
            <h1>Album not found</h1>
            <Link to="/">Back to albums</Link>
          </section>
        }
      >
        {(current) => (
          <>
            <header class="page-header">
              <div>
                <h1>{current().name}</h1>
                <p class="muted">
                  {albumPhotos().length} photo{albumPhotos().length === 1 ? '' : 's'}
                  <Show when={search().existing}> · album already existed</Show>
                </p>
              </div>
              <Link to="/">Back to albums</Link>
            </header>

            <NotesForm albumId={current().id} notes={current().notes ?? null} />

            <section>
              <div class="page-header">
                <h2>Photos</h2>
                <Link
                  to="/albums/$albumId/capture"
                  params={{ albumId: current().id }}
                  class={search().existing ? 'button-primary' : undefined}
                >
                  Add photos
                </Link>
              </div>
              <Show when={albumPhotos().length > 0} fallback={<p class="muted">No photos yet.</p>}>
                <ul class="photo-grid">
                  <For each={albumPhotos()}>
                    {(photo) => (
                      <li class="card photo-tile">
                        <Link to="/albums/$albumId/photos/$photoId" params={{ albumId: current().id, photoId: photo.id }}>
                          <PhotoThumb photoId={photo.id} alt={`Photo ${photo.position}`} class="thumb" />
                        </Link>
                        <div class="photo-tile-footer">
                          <span>#{photo.position}</span>
                          <SyncChip queued={pendingIds().has(photo.id)} />
                        </div>
                        <ConfirmButton
                          label="Delete"
                          confirmLabel="Confirm delete"
                          onConfirm={() => deletePhoto(photo.id)}
                        />
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </section>

            <Show when={error()}>
              {(message) => <p class="error" role="alert">{message()}</p>}
            </Show>
            <button type="button" onClick={() => void submit()}>
              Submit album
            </button>
          </>
        )}
      </Show>
    </main>
  );
}

function NotesForm(props: { albumId: string; notes: string | null }) {
  const [saved, setSaved] = createSignal(false);
  const form = createForm(() => ({
    defaultValues: { notes: props.notes ?? '' },
    onSubmit: async ({ value }) => {
      setSaved(false);
      await updateAlbumNotes(props.albumId, value.notes);
      setSaved(true);
    },
  }));
  const dirty = useStore(form.store, (state) => state.isDirty);

  return (
    <section class="card">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="notes" validators={{ onChange: notesSchema }}>
          {(field) => (
            <label>
              Notes
              <textarea
                name="notes"
                rows={4}
                value={field().state.value}
                onInput={(event) => field().handleChange(event.currentTarget.value)}
              />
              <Show when={errorText(field().state.meta.errors)}>
                {(message) => <span class="error">{message()}</span>}
              </Show>
            </label>
          )}
        </form.Field>
        <button type="submit" disabled={!dirty() || form.state.isSubmitting}>
          Save notes
        </button>
        <Show when={saved() && !dirty()}>
          <span class="muted">Saved locally.</span>
        </Show>
      </form>
    </section>
  );
}
