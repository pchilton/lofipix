import { createSignal, Show } from 'solid-js';

export default function ConfirmButton(props: {
  label: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  disabled?: boolean;
}) {
  const [armed, setArmed] = createSignal(false);
  const [pending, setPending] = createSignal(false);

  async function confirm() {
    setPending(true);
    try {
      await props.onConfirm();
    } finally {
      setPending(false);
      setArmed(false);
    }
  }

  return (
    <Show
      when={armed()}
      fallback={
        <button type="button" class="danger" disabled={props.disabled} onClick={() => setArmed(true)}>
          {props.label}
        </button>
      }
    >
      <span class="confirm">
        <button type="button" class="danger" disabled={pending()} onClick={confirm}>
          {props.confirmLabel}
        </button>
        <button type="button" disabled={pending()} onClick={() => setArmed(false)}>
          Cancel
        </button>
      </span>
    </Show>
  );
}
