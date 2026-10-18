import { parseArgs } from 'node:util';

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

console.log(`User seeded: ${result.user.email} (${result.user.id})`);

// Link the user to an organisation with:
// REGION=<region> bun scripts/seed-roles.ts --user "<user name>" --organisation "<organisation name>" [--role member]
process.exit(0);
