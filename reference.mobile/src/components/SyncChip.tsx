import { Chip } from '../ui';

export function SyncChip({ queued }: { queued: boolean }) {
  return <Chip label={queued ? 'Queued' : 'Synced'} tone={queued ? 'queued' : 'synced'} />;
}
