import type { Address } from '../../../types/blockchain.types.ts';

/** Storage surface the generic pending-tx hook needs (browser or test double). */
export type PendingTransactionStorageAdapter<
  TPending extends { account: Address; chainId: number },
  TKind extends string,
> = {
  load: (
    account: Address,
    chainId: number,
    kinds?: readonly TKind[],
  ) => TPending | null;
  save: (pending: TPending) => void;
  clear: (account: Address, chainId: number) => void;
};

export type UsePendingTransactionInput<
  TPending extends { account: Address; chainId: number },
  TKind extends string,
> = {
  account: Address | undefined;
  chainId: number | undefined;
  /** Action kinds this consumer owns (form vs claim/unstake). */
  kinds: readonly TKind[];
  /** Stable module-level adapter — avoid inline objects (effect loop). */
  storage: PendingTransactionStorageAdapter<TPending, TKind>;
};

export type UsePendingTransactionResult<TPending> = {
  pending: TPending | null;
  pendingLoaded: boolean;
  rememberPending: (record: TPending) => void;
  clearPendingRecord: (record?: TPending | null) => void;
  discardLocalPending: () => void;
};
