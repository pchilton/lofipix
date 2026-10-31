import { PowerSyncDatabase } from '@powersync/web';
import { APP_SCHEMA } from './schema';

export const powerSyncDatabase = new PowerSyncDatabase({
  database: { dbFilename: 'lofipix.db' },
  schema: APP_SCHEMA,
});
