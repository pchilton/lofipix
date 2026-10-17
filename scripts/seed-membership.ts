import { parseArgs } from 'node:util';

import { eq } from 'drizzle-orm';
import { db, organisations, user } from '@lofipix/db';

import { organisationObject, userObject, writeRelationship } from '../api/src/authorization';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    user: { type: 'string' },
    organisation: { type: 'string' },
    relation: { type: 'string' },
  },
});

const { user: userName, organisation: organisationName, relation = 'member' } = values;

if (!userName || !organisationName) {
  throw new Error(
    'Usage: REGION=<region> bun scripts/seed-membership.ts --user "<user name>" --organisation "<organisation name>" [--relation member]',
  );
}

try {
  const [foundUser] = await db.select().from(user).where(eq(user.name, userName)).limit(1);
  if (!foundUser) {
    throw new Error(`User not found: ${userName}`);
  }

  const [foundOrganisation] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.name, organisationName))
    .limit(1);
  if (!foundOrganisation) {
    throw new Error(`Organisation not found: ${organisationName}`);
  }

  const tuple = {
    user: userObject(foundUser.id),
    relation,
    object: organisationObject(foundOrganisation.id),
  };

  await writeRelationship(tuple);

  console.log(`Relationship seeded: ${tuple.user} ${tuple.relation} ${tuple.object}`);
} finally {
  await db.$client.end();
}

process.exit(0);
