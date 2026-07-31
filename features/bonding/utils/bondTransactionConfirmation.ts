import type { BondingTransactionConfirmation } from '../bonding.types.ts';

export type BondWaitReceiptResult = { status: 'success' | 'reverted' };

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
 * Resume paths set requireServerValidation so success is never trust-on-receipt.
 */
export async function confirmBondTransaction(
  dependencies: ConfirmBondTransactionDependencies,
): Promise<BondConfirmationOutcome> {
  const requireServer = dependencies.requireServerValidation === true;

  try {
    const receipt = await dependencies.waitForReceipt();

    if (receipt.status === 'reverted') {
      return { kind: 'reverted', source: 'browser' };
    }

    // Fresh in-session broadcast: browser receipt is enough.
    if (!requireServer) {
      return { kind: 'confirmed', source: 'browser' };
    }

    // Resume / reload: still require sender/target/calldata on the server.
    return await confirmViaServer(dependencies.confirmOnServer, null);
  } catch (receiptError) {
    return await confirmViaServer(dependencies.confirmOnServer, receiptError);
  }
}

async function confirmViaServer(
  confirmOnServer: () => Promise<BondingTransactionConfirmation>,
  receiptError: unknown,
): Promise<BondConfirmationOutcome> {
  try {
    const server = await confirmOnServer();

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
