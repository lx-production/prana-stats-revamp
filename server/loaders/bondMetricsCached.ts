import { createServerCache, ensureBondsRefreshed } from '../cacheHelpers.ts';
import { SERVER_CACHE_TTL_MS } from '../../constants/cachePolicy.ts';
import { loadBondMetrics } from './bondMetrics.ts';
import type { BondMetricsApiResponse } from '../../types/api.types.ts';

const bondMetricsCache = createServerCache<BondMetricsApiResponse>(
  SERVER_CACHE_TTL_MS.bondMetricsApiResponse,
);

async function loadBondMetricsFresh(): Promise<BondMetricsApiResponse> {
  await ensureBondsRefreshed();
  return await loadBondMetrics();
}

export function loadCachedBondMetrics(): Promise<BondMetricsApiResponse> {
  return bondMetricsCache(loadBondMetricsFresh);
}
