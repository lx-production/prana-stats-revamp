import { SERVER_CACHE_TTL_MS } from '../constants/cachePolicy.ts';
import { createBrowserJsonCache } from './browserJsonCache';
import type { StakingStatsApiResponse } from '../types/api.types';

const stakingStatsApiCache = createBrowserJsonCache({
  ttlMs: SERVER_CACHE_TTL_MS.stakingStatsApiResponse,
  getUrl: () => '/api/staking-stats',
});

export async function fetchStakingStatsApi(opts: { force?: boolean } = {}): Promise<StakingStatsApiResponse> {
  return await stakingStatsApiCache.fetchCached<StakingStatsApiResponse>(opts);
}
