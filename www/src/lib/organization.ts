import { authClient } from './auth-client';

export function slugify(value: string): string {
  const base = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base : 'organisation';
}

export function uniqueSlug(value: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slugify(value)}-${suffix}`;
}

export function describeError(
  error: { message?: string; status?: number; statusText?: string; code?: string } | null | undefined,
  fallback: string,
): string {
  return (
    error?.message ||
    error?.statusText ||
    (error?.status ? `Request failed (${error.status}).` : '') ||
    fallback
  );
}

export type CreateOrganisationResult =
  | { ok: true }
  | { ok: false; message: string };

export async function createOrganisation(name: string): Promise<CreateOrganisationResult> {
  try {
    const { error } = await authClient.organization.create({
      name,
      slug: uniqueSlug(name),
    });
    if (error) {
      return {
        ok: false,
        message: describeError(error, 'Could not create the organisation.'),
      };
    }
    return { ok: true };
  } catch (thrown) {
    return {
      ok: false,
      message: thrown instanceof Error ? thrown.message : 'Could not create the organisation.',
    };
  }
}
