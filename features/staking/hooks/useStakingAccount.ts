import { isAddress } from 'viem';
import { useQuery } from '@tanstack/react-query';
import {
  fetchStakingAccount,
  stakingAccountQueryKey,
} from '../stakingApi.ts';

import type { Address } from '../../../types/blockchain.types.ts';

/**
 * Wallet-specific balance + stakes from GET /api/staking/account.
 * Always refetch on mount so reconnecting the same wallet does not reuse a
 * stale cache entry. No polling — Bước 5 will invalidate after receipts.
 */
export function useStakingAccount(address: string | undefined) {
  const validAddress =
    address && isAddress(address) ? (address as Address) : undefined;

  return useQuery({
    queryKey: validAddress
      ? stakingAccountQueryKey(validAddress)
      : ['staking-account', 'disabled'],
    queryFn: () => fetchStakingAccount(validAddress!),
    enabled: Boolean(validAddress),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}
