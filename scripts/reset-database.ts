import '@lofipix/env';

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
  'jwks',
];

const FORBIDDEN_PUBLIC_TABLES = [
  'user',
  'session',
  'account',
  'verification',
  'organization',
  'member',
  'invitation',
  'jwks',
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
  const proc = Bun.spawn(['bunx', 'drizzle-kit', 'push', '--force'], {
    cwd: new URL('../packages/db', import.meta.url).pathname,
    env: { ...process.env },
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`drizzle-kit push failed with exit code ${code}`);
  }
}

interface TableRow {
  schemaname: string;
  tablename: string;
}

interface ForeignKeyRow {
  conname: string;
  definition: string;
}

interface CheckRow {
  conname: string;
  definition: string;
}

interface IndexRow {
  indexname: string;
  indexdef: string;
}

interface ColumnRow {
  column_name: string;
}

const EXPECTED_PHOTO_CHECKS = [
  'photos_position_positive',
  'photos_image_width_positive',
  'photos_image_height_positive',
  'photos_image_quality_range',
  'photos_image_size_non_negative',
];

async function verify(client: postgres.Sql): Promise<void> {
  const rows = await client<TableRow[]>`
    select schemaname, tablename from pg_tables
    where schemaname in ('auth', 'public') order by 1, 2
  `;
  const authTables = rows.filter((r) => r.schemaname === 'auth').map((r) => r.tablename);
  const publicTables = rows.filter((r) => r.schemaname === 'public').map((r) => r.tablename);

  const missing = EXPECTED_AUTH_TABLES.filter((t) => !authTables.includes(t));
  if (missing.length > 0) {
    throw new Error(`auth schema missing tables: ${missing.join(', ')}`);
  }

  const leaked = FORBIDDEN_PUBLIC_TABLES.filter((t) => publicTables.includes(t));
  if (leaked.length > 0) {
    throw new Error(`public schema must not contain auth tables: ${leaked.join(', ')}`);
  }

  if (!publicTables.includes('albums')) {
    throw new Error('public schema missing albums table');
  }

  const foreignKeys = await client<ForeignKeyRow[]>`
    select conname, pg_get_constraintdef(oid) as definition from pg_constraint
    where conrelid = 'public.albums'::regclass and contype = 'f'
  `;
  const organizationForeignKey = foreignKeys.find((fk) =>
    fk.definition.includes('REFERENCES auth.organization(id)'),
  );
  if (!organizationForeignKey) {
    throw new Error(
      `public.albums is missing the foreign key to auth.organization(id): ${JSON.stringify(foreignKeys)}`,
    );
  }

  const albumColumns = await client<ColumnRow[]>`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'albums'
  `;
  if (!albumColumns.some((column) => column.column_name === 'deleted_at')) {
    throw new Error('public.albums is missing the deleted_at tombstone column');
  }

  if (!publicTables.includes('photos')) {
    throw new Error('public schema missing photos table');
  }

  if (!publicTables.includes('storage_providers')) {
    throw new Error('public schema missing storage_providers table');
  }

  if (!publicTables.includes('photo_locations')) {
    throw new Error('public schema missing photo_locations table');
  }

  const photoForeignKeys = await client<ForeignKeyRow[]>`
    select conname, pg_get_constraintdef(oid) as definition from pg_constraint
    where conrelid = 'public.photos'::regclass and contype = 'f'
  `;
  const albumForeignKey = photoForeignKeys.find((fk) =>
    /REFERENCES (public\.)?albums\(id\)/.test(fk.definition),
  );
  if (!albumForeignKey) {
    throw new Error(
      `public.photos is missing the foreign key to public.albums(id): ${JSON.stringify(photoForeignKeys)}`,
    );
  }

  const photoIndexes = await client<IndexRow[]>`
    select indexname, indexdef from pg_indexes
    where schemaname = 'public' and tablename = 'photos'
  `;
  const positionIndex = photoIndexes.find(
    (idx) =>
      idx.indexname === 'photos_album_id_position_unique' &&
      idx.indexdef.includes('UNIQUE') &&
      idx.indexdef.includes('deleted_at IS NULL'),
  );
  if (!positionIndex) {
    throw new Error(
      `public.photos is missing the partial unique index on (album_id, position) where deleted_at is null: ${JSON.stringify(photoIndexes)}`,
    );
  }

  const photoChecks = await client<CheckRow[]>`
    select conname, pg_get_constraintdef(oid) as definition from pg_constraint
    where conrelid = 'public.photos'::regclass and contype = 'c'
  `;
  const missingChecks = EXPECTED_PHOTO_CHECKS.filter(
    (name) => !photoChecks.some((check) => check.conname === name),
  );
  if (missingChecks.length > 0) {
    throw new Error(
      `public.photos is missing check constraints: ${missingChecks.join(', ')} (found: ${photoChecks.map((c) => c.conname).join(', ')})`,
    );
  }

  const providerForeignKeys = await client<ForeignKeyRow[]>`
    select conname, pg_get_constraintdef(oid) as definition from pg_constraint
    where conrelid = 'public.storage_providers'::regclass and contype = 'f'
  `;
  const providerOrgForeignKey = providerForeignKeys.find((fk) =>
    fk.definition.includes('REFERENCES auth.organization(id)'),
  );
  if (!providerOrgForeignKey) {
    throw new Error(
      `public.storage_providers is missing the foreign key to auth.organization(id): ${JSON.stringify(providerForeignKeys)}`,
    );
  }

  const providerIndexes = await client<IndexRow[]>`
    select indexname, indexdef from pg_indexes
    where schemaname = 'public' and tablename = 'storage_providers'
  `;
  const providerUniqueIndex = providerIndexes.find(
    (idx) =>
      idx.indexname === 'storage_providers_org_type_external_unique' &&
      idx.indexdef.includes('UNIQUE') &&
      idx.indexdef.includes('deleted_at IS NULL'),
  );
  if (!providerUniqueIndex) {
    throw new Error(
      `public.storage_providers is missing the partial unique index on (organization_id, provider_type, external_id) where deleted_at is null: ${JSON.stringify(providerIndexes)}`,
    );
  }

  const providerChecks = await client<CheckRow[]>`
    select conname, pg_get_constraintdef(oid) as definition from pg_constraint
    where conrelid = 'public.storage_providers'::regclass and contype = 'c'
  `;
  const EXPECTED_PROVIDER_CHECKS = [
    'storage_providers_label_non_empty',
    'storage_providers_external_id_non_empty',
    'storage_providers_config_object',
    'storage_providers_encrypted_data_object',
    'storage_providers_opfs_platform',
  ];
  const missingProviderChecks = EXPECTED_PROVIDER_CHECKS.filter(
    (name) => !providerChecks.some((check) => check.conname === name),
  );
  if (missingProviderChecks.length > 0) {
    throw new Error(
      `public.storage_providers is missing check constraints: ${missingProviderChecks.join(', ')} (found: ${providerChecks.map((c) => c.conname).join(', ')})`,
    );
  }

  const locationForeignKeys = await client<ForeignKeyRow[]>`
    select conname, pg_get_constraintdef(oid) as definition from pg_constraint
    where conrelid = 'public.photo_locations'::regclass and contype = 'f'
  `;
  const locationPhotoForeignKey = locationForeignKeys.find((fk) =>
    /REFERENCES (public\.)?photos\(id\)/.test(fk.definition),
  );
  const locationProviderForeignKey = locationForeignKeys.find((fk) =>
    /REFERENCES (public\.)?storage_providers\(id\)/.test(fk.definition),
  );
  if (!locationPhotoForeignKey) {
    throw new Error(
      `public.photo_locations is missing the foreign key to public.photos(id): ${JSON.stringify(locationForeignKeys)}`,
    );
  }
  if (!locationProviderForeignKey) {
    throw new Error(
      `public.photo_locations is missing the foreign key to public.storage_providers(id): ${JSON.stringify(locationForeignKeys)}`,
    );
  }

  const locationIndexes = await client<IndexRow[]>`
    select indexname, indexdef from pg_indexes
    where schemaname = 'public' and tablename = 'photo_locations'
  `;
  const locationUniqueIndex = locationIndexes.find(
    (idx) =>
      idx.indexname === 'photo_locations_photo_provider_unique' &&
      idx.indexdef.includes('UNIQUE') &&
      idx.indexdef.includes('deleted_at IS NULL'),
  );
  if (!locationUniqueIndex) {
    throw new Error(
      `public.photo_locations is missing the partial unique index on (photo_id, storage_provider_id) where deleted_at is null: ${JSON.stringify(locationIndexes)}`,
    );
  }
  const hasLocationProviderIndex = locationIndexes.some(
    (idx) => idx.indexname === 'photo_locations_storage_provider_id_idx',
  );
  const hasLocationPhotoIndex = locationIndexes.some(
    (idx) => idx.indexname === 'photo_locations_photo_id_idx',
  );
  if (!hasLocationProviderIndex || !hasLocationPhotoIndex) {
    throw new Error(
      `public.photo_locations is missing indexes on storage_provider_id and photo_id: ${JSON.stringify(locationIndexes)}`,
    );
  }

  const locationChecks = await client<CheckRow[]>`
    select conname, pg_get_constraintdef(oid) as definition from pg_constraint
    where conrelid = 'public.photo_locations'::regclass and contype = 'c'
  `;
  const EXPECTED_LOCATION_CHECKS = ['photo_locations_object_key_non_empty'];
  const missingLocationChecks = EXPECTED_LOCATION_CHECKS.filter(
    (name) => !locationChecks.some((check) => check.conname === name),
  );
  if (missingLocationChecks.length > 0) {
    throw new Error(
      `public.photo_locations is missing check constraints: ${missingLocationChecks.join(', ')} (found: ${locationChecks.map((c) => c.conname).join(', ')})`,
    );
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
