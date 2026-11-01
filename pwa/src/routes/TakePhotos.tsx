import { createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import { Link, useNavigate, useParams } from '@tanstack/solid-router';
import { capturePhoto } from '../lib/domain/photos';
import { useLiveAlbums, useLivePhotos } from '../lib/queries';
import PhotoThumb from '../components/photo-thumb';

type CameraState = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error';

function cameraErrorState(error: unknown): { state: CameraState; message: string } {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return { state: 'denied', message: 'Camera access was denied. Allow the camera in the browser site settings and try again.' };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return { state: 'unavailable', message: 'No camera is available on this device.' };
  }
  return { state: 'error', message: error instanceof Error ? error.message : 'The camera could not be started.' };
}

export default function TakePhotos() {
  const params = useParams({ from: '/albums/$albumId/capture' });
  const navigate = useNavigate();
  const albums = useLiveAlbums();
  const photos = useLivePhotos();
  const album = () => albums().find((candidate) => candidate.id === params().albumId);
  const albumPhotos = createMemo(() =>
    photos()
      .filter((photo) => photo.albumId === params().albumId)
      .sort((a, b) => b.position - a.position),
  );

  const [camera, setCamera] = createSignal<{ state: CameraState; message: string | null }>({
    state: 'idle',
    message: null,
  });
  const [busy, setBusy] = createSignal(false);
  const [captureError, setCaptureError] = createSignal<string | null>(null);
  let video: HTMLVideoElement | undefined;
  let stream: MediaStream | undefined;

  function stopCamera() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = undefined;
  }

  async function allowCamera() {
    setCamera({ state: 'requesting', message: null });
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera({ state: 'unavailable', message: 'This browser cannot access the camera on this page.' });
      return;
    }
    try {
      stopCamera();
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      if (!video) {
        throw new Error('The camera preview is not available.');
      }
      video.srcObject = stream;
      await video.play();
      setCamera({ state: 'ready', message: null });
    } catch (error) {
      stopCamera();
      const failure = cameraErrorState(error);
      setCamera({ state: failure.state, message: failure.message });
    }
  }

  async function takePhoto() {
    const currentAlbum = album();
    if (!currentAlbum || !video) {
      return;
    }
    setBusy(true);
    setCaptureError(null);
    try {
      await capturePhoto(currentAlbum.id, video);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'The photo could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  onCleanup(stopCamera);

  return (
    <main class="page">
      <Show
        when={album()}
        fallback={
          <section>
            <h1>Album not found</h1>
            <p class="muted">It may have been deleted, or it has not synced to this device yet.</p>
            <Link to="/">Back to albums</Link>
          </section>
        }
      >
        {(current) => (
          <>
            <header class="page-header">
              <div>
                <h1>{current().name}</h1>
                <p class="muted">Take photos</p>
              </div>
              <button
                type="button"
                onClick={() => void navigate({ to: '/albums/$albumId/finish', params: { albumId: current().id } })}
              >
                Finish album
              </button>
            </header>

            <section class="camera">
              <video ref={video} autoplay playsinline muted class={camera().state === 'ready' ? 'live' : 'hidden'} />

              <Show when={camera().state !== 'ready'}>
                <div class="camera-prompt card">
                  <Show
                    when={camera().state === 'requesting'}
                    fallback={
                      <>
                        <p>
                          Allow camera access to capture damage photos. Photos are stored on this device and their details
                          sync to your organisation.
                        </p>
                        <button type="button" onClick={() => void allowCamera()}>
                          Allow camera
                        </button>
                      </>
                    }
                  >
                    <p>Waiting for camera permission…</p>
                  </Show>
                  <Show when={camera().message}>
                    {(message) => <p class="error" role="alert">{message()}</p>}
                  </Show>
                </div>
              </Show>

              <Show when={camera().state === 'ready'}>
                <div class="shutter">
                  <button type="button" disabled={busy()} onClick={() => void takePhoto()}>
                    {busy() ? 'Saving…' : 'Capture'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setCamera({ state: 'idle', message: null });
                    }}
                  >
                    Stop camera
                  </button>
                </div>
              </Show>
              <Show when={captureError()}>
                {(message) => <p class="error" role="alert">{message()}</p>}
              </Show>
            </section>

            <section>
              <h2>Captured ({albumPhotos().length})</h2>
              <div class="thumbs">
                <For each={albumPhotos().slice(0, 6)}>
                  {(photo) => <PhotoThumb photoId={photo.id} alt={`Photo ${photo.position}`} class="thumb" />}
                </For>
              </div>
            </section>
          </>
        )}
      </Show>
    </main>
  );
}
