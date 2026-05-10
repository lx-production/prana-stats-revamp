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
    (typeof candidate.surplusRunwayRemainingDays === 'number' || candidate.surplusRunwayRemainingDays === null)
  );
}

function normalizeStakingStatsResponse(value: unknown): StakingStatsApiResponse | null {
  if (isStakingStatsResponse(value)) return value;
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  const hasLegacySurplusRunway =
    typeof candidate.surplusRunwayUntilIso === 'string' ||
    candidate.surplusRunwayUntilIso === null;

  if (!hasLegacySurplusRunway) return null;

  const surplusRunwayRemainingDays =
    typeof candidate.surplusRunwayUntilIso === 'string'
      ? Math.max((new Date(candidate.surplusRunwayUntilIso).getTime() - Date.now()) / 86_400_000, 0)
      : null;

  const normalized = {
    ...candidate,
    surplusRunwayRemainingDays,
  };

  return isStakingStatsResponse(normalized) ? normalized : null;
}

export async function fetchStakingStatsApi(opts: { force?: boolean } = {}): Promise<StakingStatsApiResponse> {
  const force = opts.force === true;

  const response = await fetchJson<StakingStatsApiResponse>(buildApiUrl('/api/staking-stats', force), undefined, {
    dedupeKey: force ? null : undefined,
  });

  const normalized = normalizeStakingStatsResponse(response);
  if (normalized) {
    return normalized;
  }

  if (!force) {
    return await fetchStakingStatsApi({ force: true });
  }

  throw new Error('Failed to fetch staking stats: invalid response from /api/staking-stats');
}
