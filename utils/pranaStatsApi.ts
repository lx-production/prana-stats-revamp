import { SERVER_CACHE_TTL_MS } from '../constants/cachePolicy.ts';
import { createBrowserJsonCache } from './browserJsonCache';

import type { PranaStatsApiResponse } from '../types/api.types';

const pranaStatsApiCache = createBrowserJsonCache({
  ttlMs: SERVER_CACHE_TTL_MS.apiResponse,
  getUrl: () => '/api/prana-stats',
});

export async function fetchPranaStatsApi(): Promise<PranaStatsApiResponse> {
  return await pranaStatsApiCache.fetchCached<PranaStatsApiResponse>();
}

export function getCachedPranaStatsApi(): PranaStatsApiResponse | null {
  return pranaStatsApiCache.getCachedValue<PranaStatsApiResponse>();
}
