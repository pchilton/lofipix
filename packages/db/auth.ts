import '@lofipix/env';

import { betterAuth } from 'better-auth';
import { magicLink, emailOTP, genericOAuth, jwt, organization } from 'better-auth/plugins';
import { PostgresDialect } from 'kysely';
import { Pool } from 'pg';

function resolvePool(): Pool {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) {
    throw new Error(
      'Cannot determine the database connection: set DATABASE_URL (via a .env.<REGION> file).',
    );
  }
  return new Pool({ connectionString: DATABASE_URL, max: 1 });
}

const pool = resolvePool();

export const auth = betterAuth({
  baseURL: process.env.API_URL ?? 'http://localhost:5634',
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  database: {
    dialect: new PostgresDialect({ pool }),
    type: 'postgres',
    schemaName: 'auth',
  },
  plugins: [
    organization(),
    magicLink({
      sendMagicLink: async () => {},
    }),
    emailOTP({
      sendVerificationOTP: async () => {},
    }),
    genericOAuth({
      config: [],
    }),
    jwt(),
  ],
});

export type Auth = typeof auth;
