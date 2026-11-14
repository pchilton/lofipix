import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';

import { config } from './config';

let token: string | null = null;

export function setAuthToken(value: string | null): void {
  token = value;
}

export function getAuthToken(): string | null {
  return token;
}

export const authClient = createAuthClient({
  baseURL: config.API_URL,
  plugins: [organizationClient()],
  fetchOptions: {
    auth: {
      type: 'Bearer',
      token: () => token ?? undefined,
    },
  },
});
