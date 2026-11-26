import DataLoader from 'dataloader';
import { describe, expect, it } from 'vitest';
import { getCacheInstance } from '../cache.js';

describe('getCacheInstance', () => {
  it('stores a promise itself, not a copy that would reject with no handler', async () => {
    // node-cache's default deep clone turns a stored promise into a new one that settles with it.
    // In plain Node, a DataLoader key that failed then left that copy rejected and unhandled,
    // which shuts the server down.
    const cache = getCacheInstance({ stdTTL: 60 });
    const failed = Promise.reject(new Error('no row'));
    failed.catch(() => {});
    cache.set('2024-12-01', failed);
    expect(cache.get('2024-12-01')).toBe(failed);
  });

  it('returns the stored object itself', () => {
    const cache = getCacheInstance();
    const value = { rate: '3.7' };
    cache.set('2024-12-01', value);
    expect(cache.get('2024-12-01')).toBe(value);
  });

  it('works as a DataLoader cacheMap: a failed key fails again, others load', async () => {
    const loader = new DataLoader(
      async (keys: readonly string[]) =>
        keys.map(key => (key === 'missing' ? new Error(`no row for ${key}`) : key)),
      { cacheMap: getCacheInstance({ stdTTL: 60 }) },
    );

    await expect(loader.load('missing')).rejects.toThrow('no row for missing');
    await expect(loader.load('present')).resolves.toBe('present');
    await expect(loader.load('missing')).rejects.toThrow('no row for missing');
  });
});
