import type { Address, Hex } from '../../types/blockchain.types.ts';

/** Minimal RPC surface for on-chain confirmation — real provider or test double. */
export type ConfirmationLookupProvider = {
  getTransaction(hash: string): Promise<{
    from: string;
    to?: string | null;
    data: string;
    chainId?: number | bigint | null;
  } | null>;
  getTransactionReceipt(hash: string): Promise<{
    status: number | null;
  } | null>;
};

/** Fixed target + calldata built by each feature from its action snapshot. */
export type ExpectedCall = {
  target: Address;
  data: Hex;
};

/** Why sender/target/calldata validation failed — feature maps this to a typed error. */
export type ConfirmationMismatchReason = 'sender' | 'target' | 'calldata';

/**
 * Server-only confirmation outcomes. Confirmed/reverted always carry
 * `source: 'server'` so clients can distinguish browser vs RPC fallback.
 */
export type OnChainConfirmationResult =
  | { status: 'confirmed'; source: 'server' }
  | { status: 'reverted'; source: 'server' }
  | { status: 'not_mined' }
  | { status: 'confirmation_unavailable' };

export type ConfirmTransactionOnChainParams = {
  transactionHash: Hex;
  account: Address;
  expectedCall: ExpectedCall;
  getProvider: () => Promise<ConfirmationLookupProvider>;
  /** Feature-owned mismatch Error (keeps route 400 mapping via instanceof). */
  createMismatchError: (reason: ConfirmationMismatchReason) => Error;
};
