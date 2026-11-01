import { createMemo, createSignal, For, Show } from 'solid-js';
import { Link, useNavigate } from '@tanstack/solid-router';
import { createForm, useStore } from '@tanstack/solid-form';
import { z } from 'zod';
import { createAlbum } from '../lib/domain/albums';
import { errorText } from '../lib/form';
import { useLiveAlbums, useLivePhotos } from '../lib/queries';
import { lastOutboxError, pendingIds, syncLabel } from '../lib/outbox';
import { session, signOut, type AppSession } from '../lib/session';
import PhotoThumb from '../components/photo-thumb';
import SyncChip from '../components/sync-chip';

const albumNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter an album name.')
  .max(80, 'Keep the album name under 80 characters.');

const notesSchema = z.string().max(2000, 'Keep notes under 2000 characters.');

function normalizedName(value: string): string {
  return value.trim().toLowerCase();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const current = () => session() as AppSession;
  const albums = useLiveAlbums();
  const photos = useLivePhotos();
  const [submitError, setSubmitError] = createSignal<string | null>(null);

  const photosByAlbum = createMemo(() => {
    const grouped = new Map<string, { id: string; deletedAt: Date | null }[]>();
    for (const photo of photos()) {
      const list = grouped.get(photo.albumId) ?? [];
      list.push(photo);
      grouped.set(photo.albumId, list);
    }
    return grouped;
  });

  const form = createForm(() => ({
    defaultValues: { name: '', notes: '' },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const organizationId = current().organizationId;
      if (!organizationId || !value.name.trim()) {
        setSubmitError('This account has no organisation. Ask an administrator to add you.');
        return;
      }
      const albumId = await createAlbum(organizationId, value.name, value.notes);
      await navigate({ to: '/albums/$albumId/capture', params: { albumId } });
    },
  }));

  const name = useStore(form.store, (state) => state.values.name ?? '');
  const duplicate = createMemo(() => {
    const candidate = normalizedName(name());
    if (!candidate) {
      return undefined;
    }
    return albums().find((album) => normalizedName(album.name) === candidate);
  });

  return (
    <main class="page">
      <header class="page-header">
        <div>
          <h1>Albums</h1>
          <p class="muted">{syncLabel()}</p>
        </div>
        <button type="button" onClick={() => void signOut().then(() => navigate({ to: '/' }))}>
          Sign out
        </button>
      </header>

      <Show when={lastOutboxError()}>
        {(message) => <p class="error" role="alert">Sync error: {message()}</p>}
      </Show>

      <section class="card">
        <h2>New album</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="name" validators={{ onChange: albumNameSchema }}>
            {(field) => (
              <label>
                Album name
                <input
                  name="name"
                  required
                  maxLength={80}
                  value={field().state.value}
                  onInput={(event) => field().handleChange(event.currentTarget.value)}
                />
                <Show when={errorText(field().state.meta.errors)}>
                  {(message) => <span class="error">{message()}</span>}
                </Show>
              </label>
            )}
          </form.Field>
          <form.Field name="notes" validators={{ onChange: notesSchema }}>
            {(field) => (
              <label>
                Notes
                <textarea
                  name="notes"
                  rows={3}
                  value={field().state.value}
                  onInput={(event) => field().handleChange(event.currentTarget.value)}
                />
                <Show when={errorText(field().state.meta.errors)}>
                  {(message) => <span class="error">{message()}</span>}
                </Show>
              </label>
            )}
          </form.Field>
          <Show
            when={duplicate()}
            fallback={
              <button type="submit" disabled={form.state.isSubmitting}>
                Start album
              </button>
            }
          >
            {(album) => (
              <p class="warning">
                An album named “{album().name}” already exists.{' '}
                <Link
                  to="/albums/$albumId/finish"
                  params={{ albumId: album().id }}
                  search={{ existing: true }}
                >
                  Review existing
                </Link>
              </p>
            )}
          </Show>
          <Show when={submitError()}>
            {(message) => <p class="error" role="alert">{message()}</p>}
          </Show>
        </form>
      </section>

      <section>
        <h2>Recent albums</h2>
        <Show when={albums().length > 0} fallback={<p class="muted">No albums yet. Start one above.</p>}>
          <ul class="album-list">
            <For each={albums()}>
              {(album) => {
                const albumPhotos = () => (photosByAlbum().get(album.id) ?? []).filter((photo) => photo.deletedAt == null);
                return (
                  <li class="card album-card">
                    <div class="album-card-header">
                      <Link to="/albums/$albumId/finish" params={{ albumId: album.id }}>
                        {album.name}
                      </Link>
                      <SyncChip queued={pendingIds().has(album.id)} />
                    </div>
                    <p class="muted">
                      {albumPhotos().length} photo{albumPhotos().length === 1 ? '' : 's'}
                    </p>
                    <div class="thumbs">
                      <For each={albumPhotos().slice(0, 4)}>
                        {(photo) => <PhotoThumb photoId={photo.id} alt={`Photo ${photo.id}`} class="thumb" />}
                      </For>
                    </div>
                    <Link to="/albums/$albumId/capture" params={{ albumId: album.id }}>
                      Take photos
                    </Link>
                  </li>
                );
              }}
            </For>
          </ul>
        </Show>
      </section>
    </main>
  );
}
