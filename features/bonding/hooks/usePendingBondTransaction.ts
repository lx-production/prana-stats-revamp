import { usePendingTransaction } from '../../web3/hooks/usePendingTransaction.ts';
import {
  clearPendingBondTransaction,
  loadPendingBondTransaction,
  savePendingBondTransaction,
} from '../utils/bondPendingTransactionStorage.ts';

import type { Address } from '../../../types/blockchain.types.ts';
import type { PendingTransactionStorageAdapter } from '../../web3/hooks/usePendingTransaction.types.ts';
import type {
  BondingTxActionKind,
  PendingBondTransaction,
} from '../bonding.types.ts';

type UsePendingBondTransactionInput = {
  account: Address | undefined;
  chainId: number | undefined;
  /** Action kinds this consumer owns (form vs claim). */
  kinds: readonly BondingTxActionKind[];
};

/** Stable adapter — inline objects would re-trigger the load effect every render. */
const bondPendingStorageAdapter: PendingTransactionStorageAdapter<
  PendingBondTransaction,
  BondingTxActionKind
> = {
  load: (account, chainId, kinds) =>
    loadPendingBondTransaction(account, chainId, kinds),
  save: savePendingBondTransaction,
  clear: clearPendingBondTransaction,
};

/**
 * Persist + restore one pending bonding tx bound to account/chain.
 * Storage is untrusted — only used to resume confirmation, never as success proof.
 */
export function usePendingBondTransaction({
  account,
  chainId,
  kinds,
}: UsePendingBondTransactionInput) {
  return usePendingTransaction({
    account,
    chainId,
    kinds,
    storage: bondPendingStorageAdapter,
  });
}
