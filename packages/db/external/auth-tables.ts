import { pgSchema, text } from 'drizzle-orm/pg-core';

/**
 * Structural proxy for the Better Auth `auth.organization` table.
 *
 * It exists only so application tables can declare a foreign key towards an
 * organisation. It is deliberately NOT re-exported from `packages/db/schema.ts`,
 * so `drizzle-kit push` never manages it: the `auth` schema is owned by Better
 * Auth (see `docs/AUTHENTICATION.md`).
 */
export const authOrganization = pgSchema('auth').table('organization', {
  id: text('id').primaryKey(),
});
