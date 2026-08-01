import type { Address, Hex } from '../../types/blockchain.types.ts';

/** Minimal storage surface — browser localStorage or an in-memory test double. */
export type PendingStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** Shared pending-tx envelope. Feature action types plug into `action`. */
export type PendingTransactionEnvelope<TAction> = {
  version: 1;
  chainId: number;
  account: Address;
  hash: Hex;
  action: TAction;
  createdAt: number;
};

export type CreatePendingTransactionStorageOptions<TAction> = {
  /** e.g. `prana:staking:pending:v1` — must not change without a migration. */
  storagePrefix: string;
  /** Drop stale records after this many ms (currently 24h for both features). */
  ttlMs: number;
  /** Feature-local action validator for untrusted storage JSON. */
  parseAction: (value: unknown) => TAction | null;
};

export type BuildPendingTransactionInput<TAction> = {
  account: Address;
  chainId: number;
  hash: Hex;
  action: TAction;
  nowMs?: number;
};

export type PendingTransactionStorageApi<TAction extends { kind: string }> = {
  storageKey: (account: Address, chainId: number) => string;
  buildPendingTransaction: (
    input: BuildPendingTransactionInput<TAction>,
  ) => PendingTransactionEnvelope<TAction>;
  matchesWallet: (
    pending: PendingTransactionEnvelope<TAction>,
    account: Address | undefined,
    chainId: number | undefined,
  ) => boolean;
  save: (
    pending: PendingTransactionEnvelope<TAction>,
    storage?: PendingStorage | null,
  ) => void;
  clear: (
    account: Address,
    chainId: number,
    storage?: PendingStorage | null,
  ) => void;
  load: (
    account: Address,
    chainId: number,
    kinds?: readonly TAction['kind'][],
    storage?: PendingStorage | null,
    nowMs?: number,
  ) => PendingTransactionEnvelope<TAction> | null;
  parse: (
    raw: string,
    nowMs?: number,
  ) => PendingTransactionEnvelope<TAction> | null;
};
