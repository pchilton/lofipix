import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import fs from 'fs';
import path from 'path';

let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  // Check the standard monorepo root positions safely
  const dir = import.meta.dirname || process.cwd();
  const possiblePaths = [
    path.resolve(dir, '../../.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), '.env'),
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const match = envContent.match(/^DATABASE_URL=(.+)$/m);
      if (match) {
        databaseUrl = match[1].replace(/['"\r]/g, '').trim();
        break;
      }
    }
  }
}

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined in environment variables or .env file');
}

const globalForDb = globalThis as unknown as { conn: postgres.Sql | undefined };
const client = globalForDb.conn ?? postgres(databaseUrl);
if (process.env.NODE_ENV !== 'production') globalForDb.conn = client;

export const db = drizzle(client, { schema });
export * from './schema';
