import { useQuery } from '@tanstack/react-query';
import { BONDING_CONFIG_QUERY_KEY, fetchBondingConfig } from '../utils/bondingApi.ts';

/** Matches server Cache-Control max-age for /api/bonding/config. */
const BONDING_CONFIG_STALE_TIME_MS = 30_000;

/**
 * Protocol bonding config (terms, mins, paused, contracts).
 * Shared across the bonding page; refreshed at most every 30s via staleTime.
 */
export function useBondingConfig() {
  return useQuery({
    queryKey: BONDING_CONFIG_QUERY_KEY,
    queryFn: fetchBondingConfig,
    staleTime: BONDING_CONFIG_STALE_TIME_MS,
  });
}
