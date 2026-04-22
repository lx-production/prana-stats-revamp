import { CACHE_TTL_MS } from '../constants/cachePolicy.js';
import { createBrowserJsonCache } from './browserJsonCache';
import type { PranaStatsApiResponse } from '../types/api.types';

const pranaStatsApiCache = createBrowserJsonCache({
  ttlMs: CACHE_TTL_MS.apiResponse,
  getUrl: () => '/api/prana-stats',
});

export async function fetchPranaStatsApi(opts: { force?: boolean } = {}): Promise<PranaStatsApiResponse> {
  return await pranaStatsApiCache.fetchCached<PranaStatsApiResponse>(opts);
}

export function getCachedPranaStatsApi(): PranaStatsApiResponse | null {
  return pranaStatsApiCache.getCachedValue<PranaStatsApiResponse>();
}
