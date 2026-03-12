import { fetchJson } from './fetchJson.ts';

type CacheEntry = {
  value: unknown;
  timestamp: number;
};

type BrowserJsonCacheConfig = {
  ttlMs: number;
  getUrl: (force: boolean) => string;
  init?: RequestInit;
};

type FetchJsonCacheOptions = {
  force?: boolean;
};

export function createBrowserJsonCache(config: BrowserJsonCacheConfig) {
  let cached: CacheEntry | null = null;
  let inFlight: Promise<unknown> | null = null;

  const getCachedValue = <T = unknown>(): T | null => {
    if (!cached) return null;
    if (Date.now() - cached.timestamp >= config.ttlMs) return null;
    return cached.value as T;
  };

  const fetchCached = async <T = unknown>(opts: FetchJsonCacheOptions = {}): Promise<T> => {
    const force = opts.force === true;
    const cachedValue = !force ? getCachedValue<T>() : null;
    if (cachedValue !== null) {
      return cachedValue;
    }

    if (!force && inFlight) {
      return (await inFlight) as T;
    }

    const load = async (): Promise<T> => {
      const value = await fetchJson<T>(config.getUrl(force), config.init, {
        dedupeKey: force ? null : undefined,
      });
      cached = { value, timestamp: Date.now() };
      return value;
    };

    if (force) {
      return await load();
    }

    inFlight = load().finally(() => {
      inFlight = null;
    });

    return (await inFlight) as T;
  };

  const fetchSafe = async <T = unknown>(fallback: T, opts: FetchJsonCacheOptions = {}): Promise<T> => {
    try {
      return await fetchCached<T>(opts);
    } catch (error) {
      console.warn(`Failed to fetch ${config.getUrl(false)}`, error);
      return fallback;
    }
  };

  const clear = () => {
    cached = null;
    inFlight = null;
  };

  return {
    getCachedValue,
    fetchCached,
    fetchSafe,
    clear,
  };
}
