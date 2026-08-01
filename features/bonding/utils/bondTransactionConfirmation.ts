import { confirmBroadcastTransaction } from '../../web3/transactionConfirmation.ts';

import type { BondingTransactionConfirmation } from '../bonding.types.ts';
import type {
  BroadcastConfirmationOutcome,
  WaitReceiptResult,
} from '../../web3/transactionConfirmation.types.ts';

export type BondWaitReceiptResult = WaitReceiptResult;

export type ConfirmBondTransactionDependencies = {
  waitForReceipt: () => Promise<BondWaitReceiptResult>;
  /** Server fallback via POST /api/bonding/confirm-transaction. */
  confirmOnServer: () => Promise<BondingTransactionConfirmation>;
  /**
   * When true (resume path), browser receipt success is not enough — server
   * must still validate sender/target/full calldata before reporting confirmed.
   */
  requireServerValidation?: boolean;
};

export type BondConfirmationOutcome = BroadcastConfirmationOutcome;

/**
 * Bonding adapter over shared browser-receipt → server-fallback confirmation.
 */
export async function confirmBondTransaction(
  dependencies: ConfirmBondTransactionDependencies,
): Promise<BondConfirmationOutcome> {
  return confirmBroadcastTransaction(dependencies);
}
