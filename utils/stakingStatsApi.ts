import type { StakingStatsApiResponse } from '../types/api.types';
import { fetchJson } from './fetchJson.ts';

type LegacyPranaStatsWithStaking = {
  stakedPrana?: number | null;
  stakedVnd?: number | null;
  interestContractBalancePrana?: number | null;
  interestContractBalanceVnd?: number | null;
  interestPrana?: number | null;
  interestVnd?: number | null;
};

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
    typeof candidate.interestVnd === 'number'
  );
}

function toStakingStatsResponse(legacy: LegacyPranaStatsWithStaking): StakingStatsApiResponse | null {
  if (
    typeof legacy.stakedPrana !== 'number' ||
    typeof legacy.stakedVnd !== 'number' ||
    typeof legacy.interestContractBalancePrana !== 'number' ||
    typeof legacy.interestContractBalanceVnd !== 'number' ||
    typeof legacy.interestPrana !== 'number' ||
    typeof legacy.interestVnd !== 'number'
  ) {
    return null;
  }

  return {
    stakedPrana: legacy.stakedPrana,
    stakedVnd: legacy.stakedVnd,
    interestContractBalancePrana: legacy.interestContractBalancePrana,
    interestContractBalanceVnd: legacy.interestContractBalanceVnd,
    interestPrana: legacy.interestPrana,
    interestVnd: legacy.interestVnd,
  };
}

export async function fetchStakingStatsApi(opts: { force?: boolean } = {}): Promise<StakingStatsApiResponse> {
  const force = opts.force === true;

  try {
    const response = await fetchJson<StakingStatsApiResponse>(buildApiUrl('/api/staking-stats', force), undefined, {
      dedupeKey: force ? null : undefined,
    });
    if (isStakingStatsResponse(response)) {
      return response;
    }
  } catch {
    // Fall through to the legacy payload while servers roll forward.
  }

  const legacyResponse = await fetchJson<LegacyPranaStatsWithStaking>(buildApiUrl('/api/prana-stats', force), undefined, {
    dedupeKey: force ? null : undefined,
  });
  const stakingResponse = toStakingStatsResponse(legacyResponse);
  if (stakingResponse) {
    return stakingResponse;
  }

  throw new Error('Failed to fetch staking stats from /api/staking-stats or legacy /api/prana-stats');
}
