export function errorText(errors: readonly unknown[]): string | null {
  if (errors.length === 0) {
    return null;
  }
  const first = errors[0];
  if (typeof first === 'string') {
    return first;
  }
  if (first && typeof first === 'object' && 'message' in first && typeof first.message === 'string') {
    return first.message;
  }
  return 'Invalid value.';
}
