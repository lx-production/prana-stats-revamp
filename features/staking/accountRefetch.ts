import type { StakingAccountSnapshot } from './staking.types.ts';

/** Pull account snapshot from a React Query refetch() result. */
export function accountFromRefetch(
  refreshed: unknown,
  fallback?: StakingAccountSnapshot,
): StakingAccountSnapshot | undefined {
  if (
    refreshed &&
    typeof refreshed === 'object' &&
    'data' in refreshed &&
    (refreshed as { data?: StakingAccountSnapshot }).data
  ) {
    return (refreshed as { data: StakingAccountSnapshot }).data;
  }
  return fallback;
}
