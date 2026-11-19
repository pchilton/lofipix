import { auth } from '@lofipix/db/auth';

export async function issueSyncToken(
  userId: string,
  organizationId: string,
): Promise<string> {
  const { token } = await auth.api.signJWT({
    body: {
      payload: {
        sub: userId,
        organization_id: organizationId,
        iat: Math.floor(Date.now() / 1000),
      },
    },
  });
  return token;
}
