import { useCallback, useEffect, useRef, useState } from 'react';

import {
  clearPendingBondTransaction,
  loadPendingBondTransaction,
  savePendingBondTransaction,
} from '../utils/bondPendingTransactionStorage.ts';

import type { Address } from '../../../types/blockchain.types.ts';
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

/**
 * Persist + restore one pending bonding tx bound to account/chain.
 * Storage is untrusted — only used to resume confirmation, never as success proof.
 */
export function usePendingBondTransaction({
  account,
  chainId,
  kinds,
}: UsePendingBondTransactionInput) {
  const [pending, setPendingState] = useState<PendingBondTransaction | null>(
    null,
  );
  const [pendingLoaded, setPendingLoaded] = useState(false);
  // Keep latest pending for clear helpers without widening callback deps.
  const pendingRef = useRef<PendingBondTransaction | null>(null);
  pendingRef.current = pending;

  const kindsKey = kinds.join(',');

  useEffect(() => {
    setPendingLoaded(false);

    if (!account || chainId == null) {
      setPendingState(null);
      setPendingLoaded(true);
      return;
    }

    const kindList = kindsKey.split(',') as BondingTxActionKind[];
    const loaded = loadPendingBondTransaction(account, chainId, kindList);
    setPendingState(loaded);
    setPendingLoaded(true);
  }, [account, chainId, kindsKey]);

  /** Persist at broadcast time (hash + action + submitting identity). */
  const rememberPending = useCallback((record: PendingBondTransaction) => {
    savePendingBondTransaction(record);
    setPendingState(record);
  }, []);

  /** Terminal success/revert — drop storage for that record's identity. */
  const clearPendingRecord = useCallback(
    (record: PendingBondTransaction | null = pendingRef.current) => {
      if (record) {
        clearPendingBondTransaction(record.account, record.chainId);
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
