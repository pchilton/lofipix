import { shouldRebuildCache } from '../src/lib/db/client';

describe('local cache rebuild gate', () => {
  it('rebuilds when the outbox is drained and the device is online', () => {
    expect(shouldRebuildCache(0, true)).toBe(true);
  });

  it('refuses when work is pending', () => {
    expect(shouldRebuildCache(1, true)).toBe(false);
  });

  it('refuses while offline', () => {
    expect(shouldRebuildCache(0, false)).toBe(false);
    expect(shouldRebuildCache(3, false)).toBe(false);
  });
});
