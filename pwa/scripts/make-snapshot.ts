import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { LOCAL_SCHEMA_VERSION } from '../src/lib/db/schema';

const root = new URL('..', import.meta.url).pathname;
const schemaDir = join(root, '.pglite-schema');
const outputDir = join(root, 'public', 'pglite');
const output = join(outputDir, `schema-v${LOCAL_SCHEMA_VERSION}.tar.gz`);
const force = process.argv.includes('--force');

if (!force && existsSync(output)) {
  console.log(`Local schema snapshot already exists: ${output}`);
  process.exit(0);
}

await rm(schemaDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const proc = Bun.spawn(['bunx', 'drizzle-kit', 'push', '--force'], {
  cwd: root,
  env: { ...process.env, PGLITE_SCHEMA_DIR: schemaDir },
  stdout: 'inherit',
  stderr: 'inherit',
});
const exitCode = await proc.exited;
if (exitCode !== 0) {
  throw new Error(`drizzle-kit push failed with exit code ${exitCode}.`);
}

const pg = await PGlite.create(schemaDir);
try {
  await pg.query(
    `insert into local_meta (key, value) values ('schema_version', $1)
     on conflict (key) do update set value = excluded.value`,
    [String(LOCAL_SCHEMA_VERSION)],
  );
  const dump = await pg.dumpDataDir('gzip');
  await writeFile(output, Buffer.from(await dump.arrayBuffer()));
  console.log(`Wrote ${output}`);
} finally {
  await pg.close();
  await rm(schemaDir, { recursive: true, force: true });
}
