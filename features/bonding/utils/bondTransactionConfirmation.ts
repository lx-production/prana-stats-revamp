import type { BondingTransactionConfirmation } from '../bonding.types.ts';

export type BondWaitReceiptResult = { status: 'success' | 'reverted' };

export type ConfirmBondTransactionDependencies = {
  waitForReceipt: () => Promise<BondWaitReceiptResult>;
  /** Server fallback via POST /api/bonding/confirm-transaction. */
  confirmOnServer: () => Promise<BondingTransactionConfirmation>;
};

export type BondConfirmationOutcome =
  | { kind: 'confirmed'; source: 'browser' | 'server' }
  | { kind: 'reverted'; source: 'browser' | 'server' }
  | {
      kind: 'confirmation_unavailable';
      receiptError: unknown;
      verificationError: unknown;
    };

/**
 * Confirms an already-broadcast bonding tx without treating an RPC read
 * failure as an on-chain revert. Browser receipt first; server RPC fallback.
 */
export async function confirmBondTransaction(
  dependencies: ConfirmBondTransactionDependencies,
): Promise<BondConfirmationOutcome> {
  try {
    const receipt = await dependencies.waitForReceipt();

    if (receipt.status === 'reverted') {
      return { kind: 'reverted', source: 'browser' };
    }

    return { kind: 'confirmed', source: 'browser' };
  } catch (receiptError) {
    try {
      const server = await dependencies.confirmOnServer();

      if (server.status === 'confirmed') {
        return { kind: 'confirmed', source: 'server' };
      }
      if (server.status === 'reverted') {
        return { kind: 'reverted', source: 'server' };
      }

      // not_mined / confirmation_unavailable — still unknown, not failed.
      return {
        kind: 'confirmation_unavailable',
        receiptError,
        verificationError: new Error(`server_${server.status}`),
      };
    } catch (verificationError) {
      return {
        kind: 'confirmation_unavailable',
        receiptError,
        verificationError,
      };
    }
  }
}
