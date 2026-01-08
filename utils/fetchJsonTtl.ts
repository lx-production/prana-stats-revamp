import { fetchJson } from './fetchJson';

type CacheEntry<T> = {
  value: T;
  timestamp: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Very small TTL cache on top of fetchJson.
 * - Prevents hammering rate-limited public APIs (e.g., CoinGecko).
 * - Returns cached value if within TTL.
 * - If fetch fails and we have *any* cached value, returns the cached value.
 */
export async function fetchJsonTtl<T = unknown>(
  url: string,
  {
    ttlMs,
    init,
  }: {
    ttlMs: number;
    init?: RequestInit;
  },
): Promise<T> {
  const now = Date.now();
  const existing = cache.get(url);
  if (existing && now - existing.timestamp < ttlMs) {
    return existing.value as T;
  }

  try {
    const value = await fetchJson<T>(url, init);
    cache.set(url, { value, timestamp: now });
    return value;
  } catch (err) {
    if (existing) return existing.value as T;
    throw err;
  }
}

