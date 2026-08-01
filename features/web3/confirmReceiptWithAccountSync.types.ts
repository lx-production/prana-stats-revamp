import type { Hex } from '../../types/blockchain.types.ts';
import type {
  ServerConfirmationResult,
  WaitReceiptResult,
} from './transactionConfirmation.types.ts';

export type ConfirmReceiptWithAccountSyncDependencies = {
  hash: Hex;
  waitForReceipt: (hash: Hex) => Promise<WaitReceiptResult>;
  confirmOnServer: (hash: Hex) => Promise<ServerConfirmationResult>;
  refetchAccount: () => Promise<unknown>;
  /**
   * Feature-supplied gate (usually `accountFromSuccessfulRefetch`).
   * Shared helper stays domain-neutral — no Staking/Bonding account types.
   */
  isSuccessfulRefetch: (refreshed: unknown) => boolean;
  /**
   * Resume / reload path — browser receipt success still needs server
   * sender/target/calldata validation before UI reports confirmed.
   */
  requireServerValidation?: boolean;
};

/**
 * Outcome after broadcast confirmation + optional account sync.
 * Matches the unions UI hooks already handle for Staking/Bonding.
 */
export type ConfirmReceiptWithAccountSyncOutcome =
  | { kind: 'confirmed'; syncFailed: boolean; source: 'browser' | 'server' }
  | { kind: 'reverted'; source: 'browser' | 'server' }
  | {
      kind: 'confirmation_unavailable';
      receiptError: unknown;
      verificationError: unknown;
    };
