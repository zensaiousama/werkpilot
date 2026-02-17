// ---------------------------------------------------------------------------
// MemoryCache – Simple in-memory TTL cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(cleanupIntervalMs: number = 60_000) {
    // Auto-cleanup expired entries periodically
    this.cleanupInterval = setInterval(() => {
      this.evictExpired();
    }, cleanupIntervalMs);

    // Allow Node process to exit without waiting for the timer
    if (this.cleanupInterval && typeof this.cleanupInterval === "object" && "unref" in this.cleanupInterval) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Get a cached value by key. Returns `undefined` if the key does not exist
   * or has expired.
   */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Store a value with an optional TTL in milliseconds.
   * If `ttlMs` is omitted the entry never expires (max safe integer).
   */
  set(key: string, value: T, ttlMs?: number): void {
    const expiresAt =
      ttlMs !== undefined ? Date.now() + ttlMs : Number.MAX_SAFE_INTEGER;

    this.store.set(key, { value, expiresAt });
  }

  /**
   * Check whether a non-expired entry exists for the given key.
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a single entry.
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Remove all entries from the cache.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Return the number of entries currently stored (including not-yet-evicted
   * expired ones – call `evictExpired()` first if you need an exact count).
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Manually evict all expired entries.
   */
  evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Stop the automatic cleanup timer. Call this when the cache is no longer
   * needed (e.g. in tests).
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton instances – shared across API routes within the same process
// ---------------------------------------------------------------------------

let _sharedCache: MemoryCache<unknown> | null = null;

/**
 * Returns a shared global cache instance (singleton).
 * Usage:
 *   const cache = getSharedCache();
 *   cache.set("leads:list", data, 30_000);
 */
export function getSharedCache(): MemoryCache<unknown> {
  if (!_sharedCache) {
    _sharedCache = new MemoryCache<unknown>();
  }
  return _sharedCache;
}

/**
 * Invalidate (clear) the shared cache. Useful after mutations.
 */
export function invalidateSharedCache(): void {
  _sharedCache?.clear();
}
