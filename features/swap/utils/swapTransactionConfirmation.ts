import type {
  ConfirmSwapTransactionDependencies,
  SwapConfirmationOutcome,
} from '../../../types/swap.types';

/**
 * Confirms an already-broadcast swap without confusing an RPC read failure
 * with an on-chain revert.
 *
 * The browser RPC is the quickest path. If it cannot read the receipt, the
 * backend verifies the same transaction through its independent Polygon RPC.
 */
export async function confirmSwapTransaction(
  dependencies: ConfirmSwapTransactionDependencies,
): Promise<SwapConfirmationOutcome> {
  try {
    const receipt = await dependencies.waitForReceipt();

    if (receipt.status === 'reverted') {
      return { kind: 'reverted' };
    }

    return { kind: 'confirmed', source: 'browser' };
  } catch (receiptError) {
    try {
      await dependencies.verifyOnServer();
      return { kind: 'confirmed', source: 'server' };
    } catch (verificationError) {
      return {
        kind: 'confirmation_unavailable',
        receiptError,
        verificationError,
      };
    }
  }
}
