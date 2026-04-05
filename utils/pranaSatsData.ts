import { CACHE_TTL_MS } from '../constants/cachePolicy.js';
import type { PricePoint } from '../types/pricePoint.ts';
import { createBrowserJsonCache } from './browserJsonCache';

const pranaSatsDataCache = createBrowserJsonCache({
  ttlMs: CACHE_TTL_MS.apiResponse,
  getUrl: () => '/data_sats.json',
});

export async function fetchPranaSatsData(opts: { force?: boolean } = {}): Promise<PricePoint[]> {
  const json = await pranaSatsDataCache.fetchCached<PricePoint[]>(opts);
  return Array.isArray(json) ? json : [];
}

export function getCachedPranaSatsData(): PricePoint[] | null {
  const cached = pranaSatsDataCache.getCachedValue<PricePoint[]>();
  return Array.isArray(cached) ? cached : null;
}

export function clearPranaSatsDataCache() {
  pranaSatsDataCache.clear();
}
