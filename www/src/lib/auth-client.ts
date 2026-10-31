import { createAuthClient } from 'better-auth/solid';
import { config } from './config';

export const authClient = createAuthClient({
  baseURL: config.API_URL,
});
