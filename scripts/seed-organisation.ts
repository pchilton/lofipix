import { parseArgs } from 'node:util';

import { db, organisations, type NewOrganisation } from '@lofipix/db';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    name: { type: 'string' },
  },
});

const { name } = values;

if (!name) {
  throw new Error('Usage: REGION=<region> bun scripts/seed-organisation.ts --name <name>');
}

const organisation: NewOrganisation = {
  name,
};

try {
  await db.insert(organisations).values(organisation);
  console.log(`Organisation seeded: ${organisation.name}`);
} finally {
  await db.$client.end();
}
