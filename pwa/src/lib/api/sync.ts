import { syncUploadResponseSchema, type SyncOperation } from '@lofipix/db/schema';
import { config } from '../config';

export class SyncUploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export async function uploadSyncOperations(operations: SyncOperation[]): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${config.API_URL}api/sync/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations }),
    });
  } catch {
    throw new SyncUploadError('Upload failed: the API is unreachable.', 0, true);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    const message = body?.error ?? `Upload failed (${response.status}).`;
    throw new SyncUploadError(message, response.status, response.status >= 500 || response.status === 429);
  }

  syncUploadResponseSchema.parse(await response.json());
}
