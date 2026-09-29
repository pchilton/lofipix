import '@lofipix/env';

function composeFromPostgresEnv(): string | undefined {
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DB;
  if (!user || !password || !database) {
    return undefined;
  }

  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const port = process.env.POSTGRES_PORT ?? '5432';
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function resolveDatabaseUrl(): string {
  const { DATABASE_URL } = process.env;
  if (DATABASE_URL) {
    return DATABASE_URL;
  }

  const composed = composeFromPostgresEnv();
  if (composed) {
    return composed;
  }

  throw new Error(
    'Cannot determine the database connection: set DATABASE_URL or POSTGRES_USER, POSTGRES_PASSWORD and POSTGRES_DB (e.g. via a .env.<REGION> file).'
  );
}

export const databaseUrl = resolveDatabaseUrl();
