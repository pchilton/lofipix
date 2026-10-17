import '@lofipix/env';

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@lofipix/db';
import * as schema from '@lofipix/db/schema';

export const allowedOrigins = [
  'http://localhost:5173',
  'https://*.lofipix.app',
];

const { user, session, account, verification, ...restSchema } = schema;

export const auth = betterAuth({
  baseURL: process.env.API_URL ?? 'http://localhost:5634',
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: allowedOrigins,
  emailAndPassword: {
    enabled: true,
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification, ...restSchema },
  }),
  advanced: {
    database: {
      generateId: false,
    },
  },
});
