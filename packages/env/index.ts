import { join, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';

const GLOBAL_KEY = '__lofipix_env_initialized__';

type GlobalWithEnv = typeof globalThis & { [GLOBAL_KEY]?: boolean };

function findEnvFile(fileName: string, startDirs: string[]): string | undefined {
  for (const startDir of startDirs) {
    let currentDir = resolve(startDir);
    while (true) {
      const candidate = join(currentDir, fileName);
      if (existsSync(candidate)) {
        return candidate;
      }
      const parentDir = join(currentDir, '..');
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }
  }
  return undefined;
}

function initializeEnvironment() {
  if ((globalThis as GlobalWithEnv)[GLOBAL_KEY]) {
    return;
  }
  (globalThis as GlobalWithEnv)[GLOBAL_KEY] = true;

  const region = process.env.REGION;
  if (!region) {
    throw new Error("The 'REGION' environment variable must be specified (e.g. REGION=cholet).");
  }

  const envFileName = `.env.${region}`;
  const envFile = findEnvFile(envFileName, [process.cwd(), import.meta.dir]);

  if (!envFile) {
    console.warn(`Warning: no "${envFileName}" file found from ${process.cwd()} or ${import.meta.dir}; relying on variables already present in the environment.`);
    return;
  }

  const parsed = parseEnv(readFileSync(envFile, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

initializeEnvironment();

export const isEnvLoaded = true;
