export function supportsLocalDatabase(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.locks) &&
    typeof indexedDB !== 'undefined'
  );
}
