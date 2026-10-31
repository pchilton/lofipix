import { createEffect, createSignal, onCleanup, Show } from 'solid-js';
import { loadPhotoFile } from '../lib/photos-storage';

export default function PhotoThumb(props: { photoId: string; alt: string; class?: string }) {
  const [url, setUrl] = createSignal<string | null>(null);

  createEffect(() => {
    const id = props.photoId;
    let disposed = false;
    let currentUrl: string | null = null;
    setUrl(null);
    void loadPhotoFile(id).then((file) => {
      if (!disposed && file) {
        currentUrl = URL.createObjectURL(file);
        setUrl(currentUrl);
      }
    });
    onCleanup(() => {
      disposed = true;
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    });
  });

  return (
    <Show
      when={url()}
      fallback={<span class={`thumb-empty ${props.class ?? ''}`}>Device-only photo</span>}
    >
      {(src) => <img class={props.class} src={src()} alt={props.alt} />}
    </Show>
  );
}
