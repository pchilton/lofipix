import { parseArgs } from 'node:util';

import { and, eq } from 'drizzle-orm';
import { db, organisations, roles, roleInsertSchema, user, type NewRole } from '@lofipix/db';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    user: { type: 'string' },
    organisation: { type: 'string' },
    role: { type: 'string' },
    email: { type: 'string' },
  },
});

const { user: userName, organisation: organisationName, role: roleName = 'member', email } = values;

if (!userName || !organisationName) {
  throw new Error(
    'Usage: REGION=<region> bun scripts/seed-roles.ts --user "<user name>" --organisation "<organisation name>" --role member[,finances] [--email "<email>"]',
  );
}

const requestedRoles = roleName
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

if (requestedRoles.length === 0) {
  throw new Error('No roles provided. Must be one or more of: owner, admin, member, finances.');
}

const parsedRoles = roleInsertSchema
  .pick({ role: true })
  .array()
  .safeParse(requestedRoles.map((role) => ({ role })));
if (!parsedRoles.success) {
  throw new Error(
    `Invalid role: ${roleName}. Must be a comma separated list of: owner, admin, member, finances.`,
  );
}
const newRoles = [...new Set(parsedRoles.data.map(({ role }) => role))];

try {
  const candidates = await db.select().from(user).where(eq(user.name, userName));
  if (candidates.length === 0) {
    throw new Error(`User not found: ${userName}`);
  }

  let foundUser = candidates[0];
  if (candidates.length > 1) {
    if (!email) {
      throw new Error(
        `Multiple users found with name "${userName}". Re-run with --email "<email>" to disambiguate.`,
      );
    }

    const matching = await db
      .select()
      .from(user)
      .where(and(eq(user.name, userName), eq(user.email, email)));

    if (matching.length === 0) {
      throw new Error(`User not found with name "${userName}" and email "${email}".`);
    }
    if (matching.length > 1) {
      throw new Error(
        `Multiple users found with name "${userName}" and email "${email}". Cannot disambiguate.`,
      );
    }

    foundUser = matching[0];
  }

  const [foundOrganisation] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.name, organisationName))
    .limit(1);
  if (!foundOrganisation) {
    throw new Error(`Organisation not found: ${organisationName}`);
  }

  for (const role of newRoles) {
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
      const membership: NewRole = {
        userId: foundUser.id,
        organisationId: foundOrganisation.id,
        role,
      };

      await db.insert(roles).values(membership);
      console.log(`Role seeded: ${foundUser.name} is ${role} of ${foundOrganisation.name}`);
    }
  }
} finally {
  await db.$client.end();
}

process.exit(0);
