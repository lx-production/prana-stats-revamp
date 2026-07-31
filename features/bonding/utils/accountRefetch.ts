import type { BondingAccount } from '../bonding.types.ts';
import type { Address } from '../../../types/blockchain.types.ts';

type RefetchLike = {
  isSuccess?: boolean;
  status?: string;
  error?: unknown;
  data?: BondingAccount;
};

/**
 * Require a successful React Query refetch() result with data for the expected
 * wallet when one is supplied.
 * Does NOT fall back to cached account — stale balance/allowance must not drive
 * approve or create-bond writes.
 */
export function accountFromSuccessfulRefetch(
  refreshed: unknown,
  expectedAddress?: Address,
): BondingAccount | undefined {
  if (!refreshed || typeof refreshed !== 'object') return undefined;

  const result = refreshed as RefetchLike;
  const ok = result.isSuccess === true || result.status === 'success';
  if (!ok || result.error != null) return undefined;
  if (!result.data) return undefined;
  if (
    expectedAddress &&
    result.data.address.toLowerCase() !== expectedAddress.toLowerCase()
  ) {
    return undefined;
  }
  return result.data;
}
