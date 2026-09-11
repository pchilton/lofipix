import { defineConfig } from 'drizzle-kit';
import fs from 'node:fs';
import path from 'node:path';

const rootEnvPath = path.resolve(__dirname, '../../.env');
let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && fs.existsSync(rootEnvPath)) {
  const envContent = fs.readFileSync(rootEnvPath, 'utf-8');
  // Match the DATABASE_URL line and clean up quotes/carriage returns if present
  const match = envContent.match(/^DATABASE_URL=(.+)$/m);
  if (match) {
    databaseUrl = match[1].replace(/['"\r]/g, '').trim();
  }
}

export default defineConfig({
  schema: './schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl!,
  },
});
