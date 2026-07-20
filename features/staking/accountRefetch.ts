import type { StakingAccountSnapshot } from './staking.types.ts';

type RefetchLike = {
  isSuccess?: boolean;
  status?: string;
  error?: unknown;
  data?: StakingAccountSnapshot;
};

/**
 * Require a successful React Query refetch() result with data.
 * Does NOT fall back to cached account — stale nonce/balance must not drive
 * permit signing or stake submit.
 */
export function accountFromSuccessfulRefetch(
  refreshed: unknown,
): StakingAccountSnapshot | undefined {
  if (!refreshed || typeof refreshed !== 'object') return undefined;

  const result = refreshed as RefetchLike;
  const ok = result.isSuccess === true || result.status === 'success';
  if (!ok || result.error != null) return undefined;
  if (!result.data) return undefined;
  return result.data;
}
