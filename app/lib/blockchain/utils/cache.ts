// src/utils/cache.ts - UPDATED WITH FAILED TOKEN TRACKING

interface CacheEntry<T> {
  value: T;
  expires: number;
}

/**
 * Simple in-memory cache with TTL support
 */
export class Cache {
  private store = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, {
      value,
      expires: Date.now() + ttlMs
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  getStats() {
    const now = Date.now();
    const entries = Array.from(this.store.entries());
    const expired = entries.filter(([_, entry]) => now > entry.expires).length;

    return {
      total: this.store.size,
      valid: this.store.size - expired,
      expired
    };
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expires) {
        this.store.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

/**
 * Global cache instances
 */
export const tokenInfoCache = new Cache();
export const priceCache = new Cache();
export const failedTokenCache = new Cache(); // NEW: Track failed tokens

export const CACHE_TTL = {
  TOKEN_INFO: 24 * 60 * 60 * 1000,           // 24 hours
  PRICE_MONTHLY: 30 * 24 * 60 * 60 * 1000,  // 30 days
  PRICE_CURRENT: 5 * 60 * 1000,              // 5 minutes
  FAILED_TOKEN: 60 * 60 * 1000,              // 1 hour - don't retry failed tokens for 1 hour
} as const;