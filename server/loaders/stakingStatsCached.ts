import { createServerCache } from '../helpers/cacheHelpers.ts';
import { SERVER_CACHE_TTL_MS } from '../../constants/cachePolicy.ts';
import { loadStakingStats } from './stakingStats.ts';
import type { StakingStatsApiResponse } from '../../types/api.types.ts';

const stakingStatsCache = createServerCache<StakingStatsApiResponse>(
  SERVER_CACHE_TTL_MS.stakingStatsApiResponse,
);

export function loadCachedStakingStats(): Promise<StakingStatsApiResponse> {
  return stakingStatsCache(loadStakingStats);
}
