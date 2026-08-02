import { usePendingTransaction } from '../../web3/hooks/usePendingTransaction.ts';
import { clearPendingStakeTransaction, loadPendingStakeTransaction, savePendingStakeTransaction } from '../utils/stakePendingTransactionStorage.ts';

import type { Address } from '../../../types/blockchain.types.ts';
import type { PendingStakeTransaction, StakingTxActionKind } from '../staking.types.ts';
import type { PendingTransactionStorageAdapter } from '../../web3/hooks/usePendingTransaction.types.ts';

type UsePendingStakeTransactionInput = {
  account: Address | undefined;
  chainId: number | undefined;
  /** Action kinds this consumer owns (form vs claim/unstake). */
  kinds: readonly StakingTxActionKind[];
};

/** Stable adapter — inline objects would re-trigger the load effect every render. */
const stakePendingStorageAdapter: PendingTransactionStorageAdapter<
  PendingStakeTransaction,
  StakingTxActionKind
> = {
  load: (account, chainId, kinds) =>
    loadPendingStakeTransaction(account, chainId, kinds),
  save: savePendingStakeTransaction,
  clear: clearPendingStakeTransaction,
};

/**
 * Persist + restore one pending staking tx bound to account/chain.
 * Storage is untrusted — only used to resume confirmation, never as success proof.
 */
export function usePendingStakeTransaction({
  account,
  chainId,
  kinds,
}: UsePendingStakeTransactionInput) {
  return usePendingTransaction({
    account,
    chainId,
    kinds,
    storage: stakePendingStorageAdapter,
  });
}
