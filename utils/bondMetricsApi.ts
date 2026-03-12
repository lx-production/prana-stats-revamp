import type { BondMetricsApiResponse } from '../types/api.types';
import { CACHE_TTL_MS } from '../constants/cachePolicy.js';
import { createBrowserJsonCache } from './browserJsonCache';

const bondMetricsApiCache = createBrowserJsonCache({
  ttlMs: CACHE_TTL_MS.apiResponse,
  getUrl: () => '/api/bond-metrics',
});

export async function fetchBondMetricsApi(opts: { force?: boolean } = {}): Promise<BondMetricsApiResponse> {
  return await bondMetricsApiCache.fetchCached<BondMetricsApiResponse>(opts);
}
