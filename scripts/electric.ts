import '@lofipix/env';

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CONTAINER_NAME = 'electric';

const DOCKER_COMPOSE_YAML = `name: electric

services:
  electric:
    image: electricsql/electric:latest
    container_name: ${CONTAINER_NAME}
    restart: unless-stopped
    extra_hosts:
      - "host.docker.internal:host-gateway"
    ports:
      - "127.0.0.1:5637:3000"
    environment:
      DATABASE_URL: \${ELECTRIC_DATABASE_URL}
      ELECTRIC_SECRET: \${ELECTRIC_SECRET}
      ELECTRIC_INSECURE: "false"
      ELECTRIC_PORT: "3000"
      ELECTRIC_STORAGE_DIR: /var/lib/electric
      ELECTRIC_LOG_LEVEL: info
    volumes:
      - electric-data:/var/lib/electric

volumes:
  electric-data:
`;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
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
      const response = await fetch(`http://127.0.0.1:${port}/v1/health`, {
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
  const databaseUrl = requiredEnv('DATABASE_URL').replace(
    /@(localhost|127\.0\.0\.1)([:/])/,
    '@host.docker.internal$2',
  );
  requiredEnv('ELECTRIC_SECRET');
  process.env.ELECTRIC_DATABASE_URL = databaseUrl;

  if (dryRun) {
    console.log('--- docker-compose.yaml ---');
    console.log(DOCKER_COMPOSE_YAML);
    return;
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'lofipix-electric-'));

  try {
    await writeFile(join(tempDir, 'docker-compose.yaml'), DOCKER_COMPOSE_YAML, {
      mode: 0o644,
    });

    await run(['docker', 'compose', 'up', '-d', '--force-recreate'], {
      cwd: tempDir,
    });

    console.log(`ElectricSQL container started (region=${region}, port=5637).`);

    const timeoutMs = Number(process.env.ELECTRIC_WAIT_TIMEOUT_MS ?? 30_000);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error(
        `ELECTRIC_WAIT_TIMEOUT_MS must be a positive number of milliseconds.`,
      );
    }
    const live = await waitForLiveness(5637, timeoutMs);
    if (live) {
      console.log(`ElectricSQL is live on http://127.0.0.1:5637.`);
    } else {
      console.log(
        `ElectricSQL did not answer the health check within ${Math.round(timeoutMs / 1000)}s. ` +
          `Check \`docker logs -f ${CONTAINER_NAME}\`.`,
      );
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

await main();
