import { createServerCache } from '../cacheHelpers.ts';
import { SERVER_CACHE_TTL_MS } from '../../constants/cachePolicy.ts';
import { loadCapital } from './capital.ts';
import type { CapitalApiResponse } from '../../types/api.types.ts';

const capitalCache = createServerCache<CapitalApiResponse>(SERVER_CACHE_TTL_MS.apiResponse);

export function loadCachedCapital(): Promise<CapitalApiResponse> {
  return capitalCache(loadCapital);
}
