import '@lofipix/env';

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CONTAINER_NAME = 'powersync';
const SERVICE_NAME = 'powersync';
const SERVICE_CONFIG_PATH = '/app/powersync.yaml';
const SYNC_CONFIG_PATH = '/app/sync-config.yaml';

/**
 * Written to the temporary directory as `docker-compose.yaml`.
 * The configuration files are copied into the container, they are not mounted.
 */
const DOCKER_COMPOSE_YAML = `name: powersync

services:
  powersync:
    image: journeyapps/powersync-service:latest
    container_name: powersync
    network_mode: "host"
    restart: unless-stopped
    environment:
      NODE_ENV: production
      POWERSYNC_CONFIG_PATH: ${SERVICE_CONFIG_PATH}
`;

/**
 * Written to the temporary directory as `sync-config.yaml`.
 * Sync rules of the application: the streams and the queries backing them.
 */
const SYNC_CONFIG_YAML = `config:
  edition: 3

streams:
  global_albums:
    auto_subscribe: true
    queries:
      - SELECT albums.id, albums.organization_id, albums.name, albums.notes,
               albums.deleted_at, albums.created_at, albums.updated_at
        FROM albums
        WHERE albums.organization_id = auth.parameter('organization_id')

  global_photos:
    auto_subscribe: true
    queries:
      - SELECT photos.id, photos.album_id, photos.position, photos.image_width,
               photos.image_height, photos.image_quality, photos.image_size,
               photos.captured_at, photos.image_checksum, photos.deleted_at,
               photos.created_at, photos.updated_at
        FROM photos
        JOIN albums ON albums.id = photos.album_id
        WHERE albums.organization_id = auth.parameter('organization_id')

  global_storage_providers:
    auto_subscribe: true
    queries:
      - SELECT storage_providers.id, storage_providers.organization_id,
               storage_providers.provider_type, storage_providers.label,
               storage_providers.external_id,
               storage_providers.config - 'encrypted_data' AS config,
               storage_providers.deleted_at, storage_providers.created_at,
               storage_providers.updated_at
        FROM storage_providers
        WHERE storage_providers.organization_id = auth.parameter('organization_id')

  global_photo_locations:
    auto_subscribe: true
    queries:
      - SELECT photo_locations.id, photo_locations.photo_id,
               photo_locations.storage_provider_id, photo_locations.object_key,
               photo_locations.deleted_at, photo_locations.created_at,
               photo_locations.updated_at
        FROM photo_locations
        JOIN photos ON photos.id = photo_locations.photo_id
        JOIN albums ON albums.id = photos.album_id
        WHERE albums.organization_id = auth.parameter('organization_id')
`;

interface PowerSyncOptions {
  databaseUrl: string;
  jwksUri: string;
  audience: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

function readOptions(): PowerSyncOptions {
  return {
    databaseUrl: requiredEnv('DATABASE_URL'),
    jwksUri: requiredEnv('POWERSYNC_JWKS_URL'),
    audience: requiredEnv('POWERSYNC_AUDIENCE'),
  };
}

/**
 * JSON strings are valid YAML double quoted scalars, so they are used to escape
 * connection strings that may contain special characters.
 */
function yamlString(value: string): string {
  return JSON.stringify(value);
}

/**
 * Written to the temporary directory as `powersync.yaml`.
 */
function buildServiceYaml(options: PowerSyncOptions): string {
  return [
    'replication:',
    '  connections:',
    '    - type: postgresql',
    `      uri: ${yamlString(options.databaseUrl)}`,
    '      sslmode: "disable"',
    '',
    'storage:',
    '  type: postgresql',
    `  uri: ${yamlString(options.databaseUrl)}`,
    '  sslmode: "disable"',
    '',
    `port: 5636`,
    '',
    'sync_config:',
    `  path: ${yamlString(SYNC_CONFIG_PATH)}`,
    '',
    'client_auth:',
    `  jwks_uri: ${yamlString(options.jwksUri)}`,
    `  audience: ${JSON.stringify([options.audience])}`,
    '',
  ].join('\n');
}

async function run(
  command: string[],
  options: { cwd?: string; allowFailure?: boolean } = {},
): Promise<string> {
  const proc = Bun.spawn(command, {
    cwd: options.cwd,
    env: { ...process.env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  if (exitCode !== 0 && !options.allowFailure) {
    throw new Error(
      `${command.join(' ')} failed with exit code ${exitCode}\n${stderr.trim() || stdout.trim()}`,
    );
  }

  return stdout.trim();
}

async function waitForLiveness(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/probes/liveness`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // The service is not listening yet.
    }
    await Bun.sleep(1_000);
  }

  return false;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const region = process.env.REGION || 'unknown';
  const options = readOptions();
  const serviceYaml = buildServiceYaml(options);

  if (dryRun) {
    console.log('--- docker-compose.yaml ---');
    console.log(DOCKER_COMPOSE_YAML);
    console.log('--- powersync.yaml ---');
    console.log(serviceYaml);
    console.log('--- sync-config.yaml ---');
    console.log(SYNC_CONFIG_YAML);
    return;
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'lofipix-powersync-'));

  try {
    await writeFile(join(tempDir, 'docker-compose.yaml'), DOCKER_COMPOSE_YAML, { mode: 0o644 });
    await writeFile(join(tempDir, 'powersync.yaml'), serviceYaml, { mode: 0o644 });
    await writeFile(join(tempDir, 'sync-config.yaml'), SYNC_CONFIG_YAML, { mode: 0o644 });

    // Start from a clean container, the configuration is copied into it below.
    await run(['docker', 'rm', '--force', CONTAINER_NAME], { allowFailure: true });
    await run(['docker', 'compose', 'create', SERVICE_NAME], { cwd: tempDir });
    await run(['docker', 'cp', join(tempDir, 'powersync.yaml'), `${CONTAINER_NAME}:${SERVICE_CONFIG_PATH}`]);
    await run(['docker', 'cp', join(tempDir, 'sync-config.yaml'), `${CONTAINER_NAME}:${SYNC_CONFIG_PATH}`]);
    await run(['docker', 'compose', 'up', '-d'], { cwd: tempDir });

    console.log(`PowerSync container started (region=${region}, port=5636).`);

    const timeoutMs = Number(process.env.POWERSYNC_WAIT_TIMEOUT_MS ?? 30_000);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error(`POWERSYNC_WAIT_TIMEOUT_MS must be a positive number of milliseconds.`);
    }
    const live = await waitForLiveness(5636, timeoutMs);
    if (live) {
      console.log(`PowerSync is live on http://127.0.0.1:5636.`);
    } else {
      console.log(
        `PowerSync did not answer the liveness probe within ${Math.round(timeoutMs / 1000)}s. ` +
          `Check \`docker logs -f ${CONTAINER_NAME}\`.`,
      );
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

await main();
