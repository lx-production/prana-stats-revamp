import { CACHE_TTL_MS } from '../constants/cachePolicy.js';
import type { StakingStatsApiResponse } from '../types/api.types';
import { createBrowserJsonCache } from './browserJsonCache';

const stakingStatsApiCache = createBrowserJsonCache({
  ttlMs: CACHE_TTL_MS.apiResponse,
  getUrl: () => '/api/staking-stats',
});

type LegacyPranaStatsWithStaking = {
  stakedPrana?: number | null;
  stakedVnd?: number | null;
  interestContractBalancePrana?: number | null;
  interestContractBalanceVnd?: number | null;
  interestPrana?: number | null;
  interestVnd?: number | null;
};

const legacyPranaStatsCache = createBrowserJsonCache({
  ttlMs: CACHE_TTL_MS.apiResponse,
  getUrl: () => '/api/prana-stats',
});

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
  try {
    const response = await stakingStatsApiCache.fetchCached<StakingStatsApiResponse>(opts);
    if (isStakingStatsResponse(response)) {
      return response;
    }
  } catch {
    // Fall through to the legacy payload while servers roll forward.
  }

  const legacyResponse = await legacyPranaStatsCache.fetchCached<LegacyPranaStatsWithStaking>(opts);
  const stakingResponse = toStakingStatsResponse(legacyResponse);
  if (stakingResponse) {
    return stakingResponse;
  }

  throw new Error('Failed to fetch staking stats from /api/staking-stats or legacy /api/prana-stats');
}

export function getCachedStakingStatsApi(): StakingStatsApiResponse | null {
  const current = stakingStatsApiCache.getCachedValue<StakingStatsApiResponse>();
  if (isStakingStatsResponse(current)) {
    return current;
  }

  const legacy = legacyPranaStatsCache.getCachedValue<LegacyPranaStatsWithStaking>();
  return legacy ? toStakingStatsResponse(legacy) : null;
}
