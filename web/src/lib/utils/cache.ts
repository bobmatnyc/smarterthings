/**
 * Session Storage Cache Utility
 *
 * Provides TTL-based caching using sessionStorage for tab-scoped data persistence.
 * Automatically handles serialization, expiration, and fallback for storage failures.
 *
 * Features:
 * - TTL-based expiration (default 5 minutes)
 * - Automatic JSON serialization
 * - Graceful degradation if sessionStorage unavailable
 * - Type-safe generics
 * - Cache statistics for debugging
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  version: string;
}

const CACHE_VERSION = 'v1';

/**
 * Check if sessionStorage is available
 */
function isStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    sessionStorage.setItem(test, test);
    sessionStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get data from cache if not expired
 * @param key - Cache key
 * @param ttl - Time to live in milliseconds (default: 5 minutes)
 * @returns Cached data or null if expired/missing
 */
export function getCache<T>(key: string, ttl: number = 300000): T | null {
  if (!isStorageAvailable()) {
    console.warn('[Cache] sessionStorage unavailable');
    return null;
  }

  try {
    const cached = sessionStorage.getItem(key);
    if (!cached) {
      console.debug(`[Cache] Miss: ${key}`);
      return null;
    }

    const entry: CacheEntry<T> = JSON.parse(cached);

    // Check version mismatch
    if (entry.version !== CACHE_VERSION) {
      console.debug(`[Cache] Version mismatch for ${key}, clearing`);
      sessionStorage.removeItem(key);
      return null;
    }

    // Check TTL expiration
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      console.debug(`[Cache] Expired: ${key} (age: ${age}ms, ttl: ${entry.ttl}ms)`);
      sessionStorage.removeItem(key);
      return null;
    }

    console.debug(`[Cache] Hit: ${key} (age: ${age}ms)`);
    return entry.data;
  } catch (error) {
    console.error(`[Cache] Error reading ${key}:`, error);
    sessionStorage.removeItem(key);
    return null;
  }
}

/**
 * Set data in cache with TTL
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttl - Time to live in milliseconds (default: 5 minutes)
 */
export function setCache<T>(key: string, data: T, ttl: number = 300000): void {
  if (!isStorageAvailable()) {
    console.warn('[Cache] sessionStorage unavailable, skipping cache');
    return;
  }

  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      version: CACHE_VERSION
    };

    sessionStorage.setItem(key, JSON.stringify(entry));
    console.debug(`[Cache] Set: ${key} (ttl: ${ttl}ms)`);
  } catch (error) {
    // Handle quota exceeded or other errors
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('[Cache] Quota exceeded, clearing old caches');
      clearAllCaches();

      // Retry once after clearing
      try {
        const entry: CacheEntry<T> = {
          data,
          timestamp: Date.now(),
          ttl,
          version: CACHE_VERSION
        };
        sessionStorage.setItem(key, JSON.stringify(entry));
      } catch (retryError) {
        console.error('[Cache] Still cannot cache after clearing:', retryError);
      }
    } else {
      console.error(`[Cache] Error setting ${key}:`, error);
    }
  }
}

/**
 * Clear specific cache entry
 * @param key - Cache key to clear
 */
export function clearCache(key: string): void {
  if (!isStorageAvailable()) return;

  try {
    sessionStorage.removeItem(key);
    console.debug(`[Cache] Cleared: ${key}`);
  } catch (error) {
    console.error(`[Cache] Error clearing ${key}:`, error);
  }
}

/**
 * Clear all cache entries (keys starting with cache namespace)
 */
export function clearAllCaches(): void {
  if (!isStorageAvailable()) return;

  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith('smartthings:')) {
        keys.push(key);
      }
    }

    keys.forEach(key => sessionStorage.removeItem(key));
    console.debug(`[Cache] Cleared ${keys.length} cache entries`);
  } catch (error) {
    console.error('[Cache] Error clearing all caches:', error);
  }
}

/**
 * Get cache statistics for debugging
 * @returns Object with cache stats
 */
export function getCacheStats(): Record<string, any> {
  if (!isStorageAvailable()) {
    return { available: false };
  }

  try {
    const stats: Record<string, any> = {
      available: true,
      entries: {},
      totalSize: 0
    };

    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith('smartthings:')) {
        const value = sessionStorage.getItem(key);
        if (value) {
          const size = new Blob([value]).size;
          stats.entries[key] = {
            size: `${(size / 1024).toFixed(2)} KB`,
            age: 'N/A'
          };

          try {
            const entry = JSON.parse(value);
            const age = Date.now() - entry.timestamp;
            stats.entries[key].age = `${(age / 1000).toFixed(1)}s`;
            stats.entries[key].expired = age > entry.ttl;
          } catch (e) {
            // Ignore parse errors
          }

          stats.totalSize += size;
        }
      }
    }

    stats.totalSizeFormatted = `${(stats.totalSize / 1024).toFixed(2)} KB`;

    return stats;
  } catch (error) {
    console.error('[Cache] Error getting stats:', error);
    return { available: true, error: String(error) };
  }
}

/**
 * Cache key constants
 */
export const CACHE_KEYS = {
  DEVICES: 'smartthings:devices:v1',
  ROOMS: 'smartthings:rooms:v1',
  DEVICES_META: 'smartthings:devices:meta:v1',
  ROOMS_META: 'smartthings:rooms:meta:v1'
} as const;

/**
 * Default TTL: 5 minutes
 */
export const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
