import { parseArgs } from 'node:util';

import { eq } from 'drizzle-orm';
import { db, user } from '@lofipix/db';

import { auth } from '../api/src/auth';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    name: { type: 'string' },
    email: { type: 'string' },
    password: { type: 'string' },
  },
});

const { name, email, password } = values;

if (!name || !email || !password) {
  throw new Error(
    'Usage: REGION=<region> bun scripts/seed-user.ts --name <name> --email <email> --password <password>',
  );
}

const result = await auth.api.signUpEmail({
  body: { email, password, name },
  headers: new Headers(),
});

if (!result.user) {
  throw new Error(`Seed sign-up failed for ${email}.`);
}

// Seed users are operator-created: mark the email verified without sending a verification email.
await db.update(user).set({ emailVerified: true }).where(eq(user.id, result.user.id));

console.log(`User seeded: ${result.user.email} (${result.user.id}) [email verified]`);

// Link the user to an organisation with:
// REGION=<region> bun scripts/seed-roles.ts --user "<user name>" --organisation "<organisation name>" --role member[,finances] [--email "<disambiguation@example.com>"]
process.exit(0);