import { useCallback, useEffect, useRef, useState } from 'react';

import type { Address } from '../../../types/blockchain.types.ts';
import type { UsePendingTransactionInput, UsePendingTransactionResult } from './usePendingTransaction.types.ts';


/**
 * Persist + restore one pending tx bound to account/chain.
 * Storage is untrusted — only used to resume confirmation, never as success proof.
 * `kinds` is stabilized via join so array identity changes do not re-loop effects.
 */
export function usePendingTransaction<
  TPending extends { account: Address; chainId: number },
  TKind extends string,
>({
  account,
  chainId,
  kinds,
  storage,
}: UsePendingTransactionInput<TPending, TKind>): UsePendingTransactionResult<TPending> {
  const [pending, setPendingState] = useState<TPending | null>(null);
  const [pendingLoaded, setPendingLoaded] = useState(false);
  // Keep latest pending for clear helpers without widening callback deps.
  const pendingRef = useRef<TPending | null>(null);
  pendingRef.current = pending;

  const kindsKey = kinds.join(',');

  useEffect(() => {
    setPendingLoaded(false);

    if (!account || chainId == null) {
      setPendingState(null);
      setPendingLoaded(true);
      return;
    }

    const kindList = kindsKey.split(',') as TKind[];
    const loaded = storage.load(account, chainId, kindList);
    setPendingState(loaded);
    setPendingLoaded(true);
  }, [account, chainId, kindsKey, storage]);

  /** Persist at broadcast time (hash + action + submitting identity). */
  const rememberPending = useCallback(
    (record: TPending) => {
      storage.save(record);
      setPendingState(record);
    },
    [storage],
  );

  /** Terminal success/revert — drop storage for that record's identity. */
  const clearPendingRecord = useCallback(
    (record: TPending | null = pendingRef.current) => {
      if (record) {
        storage.clear(record.account, record.chainId);
      }
      setPendingState(null);
    },
    [storage],
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
