import { useCallback, useEffect, useRef, useState } from 'react';

import {
  clearPendingStakeTransaction,
  loadPendingStakeTransaction,
  savePendingStakeTransaction,
} from '../stakePendingTransactionStorage.ts';

import type { Address } from '../../../types/blockchain.types.ts';
import type {
  PendingStakeTransaction,
  StakingTxActionKind,
} from '../staking.types.ts';

type UsePendingStakeTransactionInput = {
  account: Address | undefined;
  chainId: number | undefined;
  /** Action kinds this consumer owns (form vs claim/unstake). */
  kinds: readonly StakingTxActionKind[];
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
  const [pending, setPendingState] = useState<PendingStakeTransaction | null>(
    null,
  );
  const [pendingLoaded, setPendingLoaded] = useState(false);
  // Keep latest pending for clear helpers without widening callback deps.
  const pendingRef = useRef<PendingStakeTransaction | null>(null);
  pendingRef.current = pending;

  const kindsKey = kinds.join(',');

  useEffect(() => {
    setPendingLoaded(false);

    if (!account || chainId == null) {
      setPendingState(null);
      setPendingLoaded(true);
      return;
    }

    const kindList = kindsKey.split(',') as StakingTxActionKind[];
    const loaded = loadPendingStakeTransaction(account, chainId, kindList);
    setPendingState(loaded);
    setPendingLoaded(true);
  }, [account, chainId, kindsKey]);

  /** Persist at broadcast time (hash + action + submitting identity). */
  const rememberPending = useCallback((record: PendingStakeTransaction) => {
    savePendingStakeTransaction(record);
    setPendingState(record);
  }, []);

  /** Terminal success/revert — drop storage for that record's identity. */
  const clearPendingRecord = useCallback(
    (record: PendingStakeTransaction | null = pendingRef.current) => {
      if (record) {
        clearPendingStakeTransaction(record.account, record.chainId);
      }
      setPendingState(null);
    },
    [],
  );

  /**
   * Drop React state only (keep storage). Used when the connected wallet no
   * longer matches the submitting account so we do not show foreign success.
   */
  const discardLocalPending = useCallback(() => {
    setPendingState(null);
  }, []);

  return {
    pending,
    pendingLoaded,
    rememberPending,
    clearPendingRecord,
    discardLocalPending,
  };
}
