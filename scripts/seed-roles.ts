import { parseArgs } from 'node:util';

import { and, eq } from 'drizzle-orm';
import { db, organisations, roles, roleSchema, user } from '@lofipix/db';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    user: { type: 'string' },
    organisation: { type: 'string' },
    role: { type: 'string' },
  },
});

const { user: userName, organisation: organisationName, role: roleName = 'member' } = values;

if (!userName || !organisationName) {
  throw new Error(
    'Usage: REGION=<region> bun scripts/seed-roles.ts --user "<user name>" --organisation "<organisation name>" [--role member]',
  );
}

const parsedRole = roleSchema.safeParse(roleName);
if (!parsedRole.success) {
  throw new Error(`Invalid role: ${roleName}. Must be one of: owner, admin, member, finances.`);
}
const role = parsedRole.data;

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

  const [existing] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(
      and(
        eq(roles.userId, foundUser.id),
        eq(roles.organisationId, foundOrganisation.id),
        eq(roles.role, role),
      ),
    )
    .limit(1);

  if (existing) {
    console.log(`Role already granted: ${foundUser.name} is ${role} of ${foundOrganisation.name}`);
  } else {
    await db.insert(roles).values({
      userId: foundUser.id,
      organisationId: foundOrganisation.id,
      role,
    });
    console.log(`Role seeded: ${foundUser.name} is ${role} of ${foundOrganisation.name}`);
  }
} finally {
  await db.$client.end();
}

process.exit(0);
