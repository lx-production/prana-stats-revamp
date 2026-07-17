import { fetchJson } from './fetchJson.ts';

type CacheEntry = {
  value: unknown;
  timestamp: number;
};

type BrowserJsonCacheConfig = {
  ttlMs: number;
  getUrl: () => string;
  init?: RequestInit;
};

export function createBrowserJsonCache(config: BrowserJsonCacheConfig) {
  let cached: CacheEntry | null = null;
  let inFlight: Promise<unknown> | null = null;

  const getCachedValue = <T = unknown>(): T | null => {
    if (!cached) return null;
    if (Date.now() - cached.timestamp >= config.ttlMs) return null;
    return cached.value as T;
  };

  // Return cached value within TTL; otherwise share one in-flight fetch.
  const fetchCached = async <T = unknown>(): Promise<T> => {
    const cachedValue = getCachedValue<T>();
    if (cachedValue !== null) {
      return cachedValue;
    }

    if (inFlight) {
      return (await inFlight) as T;
    }

    const load = async (): Promise<T> => {
      const value = await fetchJson<T>(config.getUrl(), config.init);
      cached = { value, timestamp: Date.now() };
      return value;
    };

    inFlight = load().finally(() => {
      inFlight = null;
    });

    return (await inFlight) as T;
  };

  return {
    getCachedValue,
    fetchCached,
  };
}
