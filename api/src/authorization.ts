import '@lofipix/env';

import {
  ClientWriteRequestOnDuplicateWrites,
  CredentialsMethod,
  OpenFgaClient,
  type UserClientConfigurationParams,
} from '@openfga/sdk';
import type { Context, MiddlewareHandler } from 'hono';

export interface OpenFgaConfig {
  apiUrl: string;
  storeId?: string;
  authorizationModelId?: string;
  apiToken?: string;
}

function resolveOpenFgaConfig(): OpenFgaConfig {
  const { OPENFGA_API_URL, OPENFGA_STORE_ID, OPENFGA_AUTHORIZATION_MODEL_ID, OPENFGA_API_TOKEN } =
    process.env;

  return {
    apiUrl: OPENFGA_API_URL ?? 'http://127.0.0.1:8080',
    storeId: OPENFGA_STORE_ID,
    authorizationModelId: OPENFGA_AUTHORIZATION_MODEL_ID,
    apiToken: OPENFGA_API_TOKEN,
  };
}

export function createOpenFgaClient(config: OpenFgaConfig = resolveOpenFgaConfig()): OpenFgaClient {
  const params: UserClientConfigurationParams = {
    apiUrl: config.apiUrl,
    storeId: config.storeId,
    authorizationModelId: config.authorizationModelId,
  };

  if (config.apiToken) {
    params.credentials = {
      method: CredentialsMethod.ApiToken,
      config: { token: config.apiToken },
    };
  }

  return new OpenFgaClient(params);
}

export const openfga = createOpenFgaClient();

export const organisationObject = (organisationId: string): string =>
  `organisation:${organisationId}`;

export const userObject = (userId: string): string =>
  userId.includes(':') ? userId : `user:${userId}`;

export type OrganisationRelation = 'member' | 'admin' | 'can_view' | 'can_manage';

export async function isAuthorized(
  user: string,
  relation: string,
  object: string
): Promise<boolean> {
  const { allowed } = await openfga.check({ user, relation, object });
  return allowed === true;
}

export interface RelationshipTuple {
  user: string;
  relation: string;
  object: string;
}

export async function writeRelationship({ user, relation, object }: RelationshipTuple): Promise<void> {
  await openfga.write(
    { writes: [{ user, relation, object }] },
    { conflict: { onDuplicateWrites: ClientWriteRequestOnDuplicateWrites.Ignore } }
  );
}

function defaultGetUserId(c: Context<any>): string | undefined {
  const user = c.get('user') as { id?: string } | undefined;
  return user?.id ?? (c.get('userId') as string | undefined);
}

export interface RequirePermissionOptions {
  relation: string;
  object: string | ((c: Context<any>) => string | Promise<string>);
  getUserId?: (c: Context<any>) => string | undefined;
}

export function requirePermission(options: RequirePermissionOptions): MiddlewareHandler {
  return async (c, next) => {
    const getUserId = options.getUserId ?? defaultGetUserId;
    const userId = getUserId(c);

    if (!userId) {
      return c.json({ error: 'Unauthenticated' }, 401);
    }

    const object =
      typeof options.object === 'function' ? await options.object(c) : options.object;

    const allowed = await isAuthorized(userObject(userId), options.relation, object);
    if (!allowed) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await next();
  };
}

export function requireOrganisationRelation(
  relation: OrganisationRelation,
  param = 'organisationId'
): MiddlewareHandler {
  return requirePermission({
    relation,
    object: (c) => {
      const organisationId = c.req.param(param);
      if (!organisationId) {
        throw new Error(`Missing route parameter "${param}" for the organisation authorization check.`);
      }
      return organisationObject(organisationId);
    },
  });
}
