import { defineConfig } from 'drizzle-kit';
import '@lofipix/env';
import { databaseUrl } from './connection';

export default defineConfig({
  schema: './schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
