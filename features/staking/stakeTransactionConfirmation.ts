import { confirmBroadcastTransaction } from '../web3/transactionConfirmation.ts';

import type { StakingTransactionConfirmation } from './staking.types.ts';
import type {
  BroadcastConfirmationOutcome,
  WaitReceiptResult,
} from '../web3/transactionConfirmation.types.ts';

export type StakeWaitReceiptResult = WaitReceiptResult;

export type ConfirmStakeTransactionDependencies = {
  waitForReceipt: () => Promise<StakeWaitReceiptResult>;
  /** Server fallback via POST /api/staking/confirm-transaction. */
  confirmOnServer: () => Promise<StakingTransactionConfirmation>;
  /**
   * When true (resume path), browser receipt success is not enough — server
   * must still validate sender/target/full calldata before reporting confirmed.
   */
  requireServerValidation?: boolean;
};

export type StakeConfirmationOutcome = BroadcastConfirmationOutcome;

/**
 * Staking adapter over shared browser-receipt → server-fallback confirmation.
 */
export async function confirmStakeTransaction(
  dependencies: ConfirmStakeTransactionDependencies,
): Promise<StakeConfirmationOutcome> {
  return confirmBroadcastTransaction(dependencies);
}
