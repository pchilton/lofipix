export default function SyncChip(props: { queued: boolean }) {
  return (
    <span class={`chip ${props.queued ? 'chip-queued' : 'chip-synced'}`}>
      {props.queued ? 'Queued' : 'Synced'}
    </span>
  );
}
