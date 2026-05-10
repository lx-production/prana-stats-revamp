import type { StakingStatsApiResponse } from '../types/api.types';
import { fetchJson } from './fetchJson.ts';

function buildApiUrl(path: string, force: boolean): string {
  if (!force) return path;

  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}_=${Date.now()}`;
}

function isStakingStatsResponse(value: unknown): value is StakingStatsApiResponse {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.stakedPrana === 'number' &&
    typeof candidate.stakedVnd === 'number' &&
    typeof candidate.interestContractBalancePrana === 'number' &&
    typeof candidate.interestContractBalanceVnd === 'number' &&
    typeof candidate.interestPrana === 'number' &&
    typeof candidate.interestVnd === 'number' &&
    typeof candidate.claimableUnclaimedInterestPrana === 'number' &&
    typeof candidate.dailyInterestPrana === 'number' &&
    (typeof candidate.runwayDays === 'number' || candidate.runwayDays === null)
  );
}

export async function fetchStakingStatsApi(opts: { force?: boolean } = {}): Promise<StakingStatsApiResponse> {
  const force = opts.force === true;

  const response = await fetchJson<StakingStatsApiResponse>(buildApiUrl('/api/staking-stats', force), undefined, {
    dedupeKey: force ? null : undefined,
  });

  if (isStakingStatsResponse(response)) {
    return response;
  }

  if (!force) {
    return await fetchStakingStatsApi({ force: true });
  }

  throw new Error('Failed to fetch staking stats: invalid response from /api/staking-stats');
}
