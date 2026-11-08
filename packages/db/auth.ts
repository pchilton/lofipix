import '@lofipix/env';

import { betterAuth } from 'better-auth';
import {
  bearer,
  magicLink,
  emailOTP,
  genericOAuth,
  jwt,
  organization,
} from 'better-auth/plugins';
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

const baseURL = process.env.API_URL ?? 'http://192.168.1.15:5634';
const isProduction = baseURL.startsWith('https://');

type FindOrganisationOfUser = (userId: string) => Promise<string | null>;

let findOrganisationOfUser: FindOrganisationOfUser | undefined;

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    'http://192.168.1.15:5173',
    'http://192.168.1.15:4173',
    'https://www.lofipix.app',
    'lofipix://',
  ],
  advanced: isProduction
    ? {
        crossSubDomainCookies: {
          enabled: true,
          domain: '.lofipix.app',
        },
      }
    : undefined,
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          if (typeof session.activeOrganizationId === 'string') {
            return;
          }
          const organizationId = await findOrganisationOfUser?.(session.userId);
          if (!organizationId) {
            return;
          }
          return { data: { ...session, activeOrganizationId: organizationId } };
        },
      },
    },
  },
  database: {
    dialect: new PostgresDialect({ pool }),
    type: 'postgres',
    schemaName: 'auth',
  },
  plugins: [
    organization({ organizationLimit: 1 }),
    bearer(),
    magicLink({
      sendMagicLink: async () => {},
    }),
    emailOTP({
      sendVerificationOTP: async () => {},
    }),
    genericOAuth({
      config: [],
    }),
    jwt({
      jwks: {
        keyPairConfig: { alg: 'EdDSA', crv: 'Ed25519' },
      },
      jwt: {
        issuer: baseURL,
        audience: 'lofipix',
        expirationTime: '5m',
        definePayload: ({ session }) => ({
          organization_id: session.activeOrganizationId ?? null,
        }),
      },
    }),
  ],
});

findOrganisationOfUser = async (userId) => {
  const context = await auth.$context;
  const member = await context.adapter.findOne<{ organizationId: string }>({
    model: 'member',
    where: [{ field: 'userId', value: userId }],
  });
  return member?.organizationId ?? null;
};

export type Auth = typeof auth;
