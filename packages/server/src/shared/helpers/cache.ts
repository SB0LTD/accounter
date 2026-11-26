import NodeCache from 'node-cache';

/**
 * A TTL cache, also used as a DataLoader `cacheMap`.
 *
 * Values are stored by reference (`useClones: false`) unless the caller asks otherwise. A DataLoader
 * stores promises here, and node-cache's default deep clone copies a promise into a new one that
 * settles with it: when a key's load rejects, that copy rejects with no handler, and the server
 * treats an unhandled rejection as fatal. DataLoader's own default cache (a `Map`) keeps references
 * too.
 */
export function getCacheInstance(options?: NodeCache.Options) {
  const instance = new NodeCache({ useClones: false, ...options });

  return {
    get: instance.get.bind(instance),
    set: instance.set.bind(instance),
    delete: instance.del.bind(instance),
    clear: instance.flushAll.bind(instance),
  };
}
