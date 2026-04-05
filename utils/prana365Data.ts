import { CACHE_TTL_MS } from '../constants/cachePolicy.js';
import { createBrowserJsonCache } from './browserJsonCache';
import type { PricePoint } from '../types/pricePoint.ts';

const prana365DataCache = createBrowserJsonCache({
  ttlMs: CACHE_TTL_MS.apiResponse,
  getUrl: () => '/data_365_days.json',
});

export async function fetchPrana365Data(opts: { force?: boolean } = {}): Promise<PricePoint[]> {
  const json = await prana365DataCache.fetchCached<PricePoint[]>(opts);
  return Array.isArray(json) ? json : [];
}

export function getCachedPrana365Data(): PricePoint[] | null {
  const cached = prana365DataCache.getCachedValue<PricePoint[]>();
  return Array.isArray(cached) ? cached : null;
}

export function clearPrana365DataCache() {
  prana365DataCache.clear();
}
