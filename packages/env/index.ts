import { join } from 'path';
import { parseEnv } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';

function initializeEnvironment() {
  const region = process.env.REGION;
  if (!region) {
    throw new Error("❌ Deployment Error: The 'REGION' environment variable must be specified.");
  }

  const envFileName = `.env.${region}`;
  
  // Note: import.meta.dir here evaluates to packages/env/ 
  let currentDir = import.meta.dir; 
  let envFileFound = false;

  // Traverse up 4 levels to look for the file (covers packages/env/, packages/, root, and root's parent)
  for (let depth = 0; depth < 4; depth++) {
    const targetPath = join(currentDir, envFileName);
    
    if (existsSync(targetPath)) {
      const envText = readFileSync(targetPath, 'utf8');
      Object.assign(process.env, parseEnv(envText));
      envFileFound = true;
      break;
    }
    
    currentDir = join(currentDir, '..');
  }

  if (!envFileFound) {
    console.warn(`⚠️ Warning: Region file "${envFileName}" could not be found up to 3 parent directories deep.`);
  }
}

// 💥 Triggers immediately on the absolute first import across the entire runtime execution
initializeEnvironment();

export const isEnvLoaded = true;
