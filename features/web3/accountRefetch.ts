import type { Address } from '../../types/blockchain.types.ts';
import type { RefetchLikeResult } from './accountRefetch.types.ts';

/**
 * Require a successful React Query refetch() result with data for the expected
 * wallet when one is supplied.
 * Does NOT fall back to cached account — stale nonce/balance/allowance must not
 * drive permit signing, approve, or create/stake writes.
 */
export function accountFromSuccessfulRefetch<
  TAccount extends { address: string },
>(
  refreshed: unknown,
  expectedAddress?: Address,
): TAccount | undefined {
  if (!refreshed || typeof refreshed !== 'object') return undefined;

  const result = refreshed as RefetchLikeResult<TAccount>;
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
