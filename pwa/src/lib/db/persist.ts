import type { Transaction } from '@tanstack/solid-db';

export async function persistWrite(transaction: Transaction<any>): Promise<void> {
  const settled = await transaction.when('settled');
  if (settled.state === 'failed') {
    throw new Error(settled.error?.message ?? 'The local write failed.');
  }
  if (settled.state !== 'completed') {
    throw new Error('The local write did not complete.');
  }
}
