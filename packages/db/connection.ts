import '@lofipix/env';

function resolveDatabaseUrl(): string {
  const { DATABASE_URL } = process.env;
  if (DATABASE_URL) {
    return DATABASE_URL;
  }

  throw new Error(
    'Cannot determine the database connection: set DATABASE_URL (via a .env.<REGION> file).'
  );
}

export const databaseUrl = resolveDatabaseUrl();
