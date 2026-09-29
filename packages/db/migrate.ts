import '@lofipix/env';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { join } from 'node:path';
import { databaseUrl } from './connection';

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: join(import.meta.dir, 'drizzle') });
  console.log('Migrations applied.');
} finally {
  await client.end();
}
