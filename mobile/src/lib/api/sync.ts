import {
  syncMutationsResponseSchema,
  type SyncMutation,
  type SyncMutationsResponse,
} from '@lofipix/db/schema';

import { getAuthToken } from '../auth-client';
import { config } from '../config';

export class SyncTransportError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'SyncTransportError';
  }
}

export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function sendSyncMutations(
  mutations: SyncMutation[],
): Promise<SyncMutationsResponse> {
  let response: Response;
  try {
    response = await fetch(`${config.API_URL}api/sync/mutations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ mutations }),
    });
  } catch {
    throw new SyncTransportError('Upload failed: the API is unreachable.', 0, true);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    const message = body?.error ?? `Upload failed (${response.status}).`;
    throw new SyncTransportError(message, response.status, response.status >= 500 || response.status === 429);
  }

  return syncMutationsResponseSchema.parse(await response.json());
}
