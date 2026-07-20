import { useQuery } from '@tanstack/react-query';
import {
  fetchStakingConfig,
  STAKING_CONFIG_QUERY_KEY,
} from '../stakingApi.ts';

/** Matches server Cache-Control max-age for /api/staking/config. */
const STAKING_CONFIG_STALE_TIME_MS = 30_000;

/**
 * Protocol staking config (durations, min stake, paused, contracts).
 * Shared across the staking page; refreshed at most every 30s via staleTime.
 */
export function useStakingConfig() {
  return useQuery({
    queryKey: STAKING_CONFIG_QUERY_KEY,
    queryFn: fetchStakingConfig,
    staleTime: STAKING_CONFIG_STALE_TIME_MS,
  });
}
