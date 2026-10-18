import '@lofipix/env';

import { and, eq, inArray } from 'drizzle-orm';
import type { Context, MiddlewareHandler } from 'hono';

import { db, roles, type OrganisationRole } from '@lofipix/db';

export type { OrganisationRole };
export { roleValues } from '@lofipix/db';

function defaultGetUserId(c: Context<any>): string | undefined {
  const user = c.get('user') as { id?: string } | undefined;
  return user?.id ?? (c.get('userId') as string | undefined);
}

export async function getUserRoles(userId: string, organisationId: string): Promise<OrganisationRole[]> {
  const rows = await db
    .select({ role: roles.role })
    .from(roles)
    .where(and(eq(roles.userId, userId), eq(roles.organisationId, organisationId)));
  return rows.map((row) => row.role);
}

export async function hasRole(
  userId: string,
  organisationId: string,
  ...allowed: OrganisationRole[]
): Promise<boolean> {
  if (allowed.length === 0) {
    return false;
  }
  const rows = await db
    .select({ id: roles.id })
    .from(roles)
    .where(
      and(
        eq(roles.userId, userId),
        eq(roles.organisationId, organisationId),
        inArray(roles.role, allowed),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export interface RequireOrganisationRoleOptions {
  getUserId?: (c: Context<any>) => string | undefined;
  param?: string;
}

export function requireOrganisationRole(
  ...allowedAndOptions: Array<OrganisationRole | RequireOrganisationRoleOptions>
): MiddlewareHandler {
  let allowed: OrganisationRole[];
  let options: RequireOrganisationRoleOptions = {};

  const last = allowedAndOptions[allowedAndOptions.length - 1];
  if (
    last !== undefined &&
    typeof last === 'object' &&
    ('getUserId' in last || 'param' in last)
  ) {
    options = last;
    allowed = allowedAndOptions.slice(0, -1) as OrganisationRole[];
  } else {
    allowed = allowedAndOptions as OrganisationRole[];
  }

  const param = options.param ?? 'organisationId';

  return async (c, next) => {
    const getUserId = options.getUserId ?? defaultGetUserId;
    const userId = getUserId(c);

    if (!userId) {
      return c.json({ error: 'Unauthenticated' }, 401);
    }

    const organisationId = c.req.param(param);
    if (!organisationId) {
      throw new Error(`Missing route parameter "${param}" for the organisation role check.`);
    }

    const allowedAccess = await hasRole(userId, organisationId, ...allowed);
    if (!allowedAccess) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await next();
  };
}

export const requireRole = requireOrganisationRole;
