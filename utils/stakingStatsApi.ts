import { fetchJson } from './fetchJson.ts';

import type { StakingStatsApiResponse } from '../types/api.types';

// Browser relies on HTTP Cache-Control (24h) + fetchJson GET dedupe; no in-memory TTL layer.
export async function fetchStakingStatsApi(): Promise<StakingStatsApiResponse> {
  return await fetchJson<StakingStatsApiResponse>('/api/staking-stats');
}
