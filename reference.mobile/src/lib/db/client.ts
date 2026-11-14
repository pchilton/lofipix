import { PowerSyncDatabase } from '@powersync/react-native';
import { AppSchema } from './schema';

export const powerSync = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'lofipix.db' },
});

export async function clearPowerSyncDatabase(): Promise<void> {
  await powerSync.disconnectAndClear();
}
