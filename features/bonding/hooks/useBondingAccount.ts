import { isAddress } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { bondingAccountQueryKey, fetchBondingAccount } from '../utils/bondingApi.ts';

import type { Address } from '../../../types/blockchain.types.ts';

/**
 * Wallet-specific balances + active bonds from GET /api/bonding/account.
 * Always refetch on mount so reconnecting the same wallet does not reuse a
 * stale cache entry.
 */
export function useBondingAccount(address: string | undefined) {
  const validAddress =
    address && isAddress(address) ? (address as Address) : undefined;

  return useQuery({
    queryKey: validAddress
      ? bondingAccountQueryKey(validAddress)
      : ['bonding-account', 'disabled'],
    queryFn: () => fetchBondingAccount(validAddress!),
    enabled: Boolean(validAddress),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}
