import { createServerCache } from '../helpers/cacheHelpers.ts';
import { SERVER_CACHE_TTL_MS } from '../../constants/cachePolicy.ts';
import { loadLpCapital } from './lpCapital.ts';
import type { LpCapitalApiResponse } from '../../types/api.types.ts';

const lpCapitalCache = createServerCache<LpCapitalApiResponse>(
  SERVER_CACHE_TTL_MS.lpCapitalApiResponse,
);

export function loadCachedLpCapital(): Promise<LpCapitalApiResponse> {
  return lpCapitalCache(loadLpCapital);
}
