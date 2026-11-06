import '@lofipix/env';

import { join } from 'node:path';
import postgres from 'postgres';
import { auth } from '@lofipix/db/auth';
import { getMigrations } from 'better-auth/db/migration';
import { databaseUrl } from '@lofipix/db/connection';

const EXPECTED_AUTH_TABLES = [
  'user',
  'session',
  'account',
  'verification',
  'organization',
  'member',
  'invitation',
];

const EXPECTED_PUBLIC_TABLES = [
  'albums',
  'photos',
  'storage_providers',
  'photo_locations',
  'sync_mutations',
];

async function resetSchemas(client: postgres.Sql): Promise<void> {
  await client.unsafe('DROP SCHEMA IF EXISTS public CASCADE');
  await client.unsafe('DROP SCHEMA IF EXISTS auth CASCADE');
  await client.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE');
  await client.unsafe('CREATE SCHEMA public');
  await client.unsafe('CREATE SCHEMA drizzle');
  await client.unsafe('CREATE SCHEMA auth');
}

async function syncAuthSchema(): Promise<void> {
  const plan = await getMigrations(auth.options, { throwOnUnsafe: false });
  await plan.runMigrations();
  console.log(
    `auth schema synced (${plan.toBeCreated.length} tables created, ${plan.toBeAdded.length} columns added).`,
  );
}

async function pushPublicSchema(): Promise<void> {
  const dbDir = new URL('../packages/db', import.meta.url).pathname;
  const proc = Bun.spawn(
    ['bun', join(dbDir, 'node_modules/drizzle-kit/bin.cjs'), 'push', '--force'],
    {
      cwd: dbDir,
      env: { ...process.env },
      stdout: 'inherit',
      stderr: 'inherit',
    },
  );
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`drizzle-kit push failed with exit code ${code}`);
  }
}

async function verify(client: postgres.Sql): Promise<void> {
  const rows = await client<{ schemaname: string; tablename: string }[]>`
    select schemaname, tablename from pg_tables
    where schemaname in ('auth', 'public') order by 1, 2
  `;
  const authTables = rows.filter((r) => r.schemaname === 'auth').map((r) => r.tablename);
  const publicTables = rows.filter((r) => r.schemaname === 'public').map((r) => r.tablename);

  const missingAuth = EXPECTED_AUTH_TABLES.filter((t) => !authTables.includes(t));
  if (missingAuth.length > 0) {
    throw new Error(`auth schema missing tables: ${missingAuth.join(', ')}`);
  }

  const missingPublic = EXPECTED_PUBLIC_TABLES.filter((t) => !publicTables.includes(t));
  if (missingPublic.length > 0) {
    throw new Error(`public schema missing tables: ${missingPublic.join(', ')}`);
  }

  console.log(`auth tables: ${authTables.join(', ')}`);
  console.log(`public tables: ${publicTables.join(', ')}`);
}

const client = postgres(databaseUrl, { max: 1 });

try {
  await resetSchemas(client);
  console.log('schemas recreated (auth, public).');
  await syncAuthSchema();
  await pushPublicSchema();
  await verify(client);
  console.log('Database reset complete.');
} finally {
  await client.end();
}
