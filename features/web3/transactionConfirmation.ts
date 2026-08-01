import type {
  BroadcastConfirmationOutcome,
  ConfirmBroadcastTransactionDependencies,
  ServerConfirmationResult,
} from './transactionConfirmation.types.ts';

/**
 * Confirms an already-broadcast tx without treating an RPC read failure as an
 * on-chain revert. Browser receipt first; server RPC fallback.
 * Resume paths set requireServerValidation so success is never trust-on-receipt.
 */
export async function confirmBroadcastTransaction(
  dependencies: ConfirmBroadcastTransactionDependencies,
): Promise<BroadcastConfirmationOutcome> {
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
  confirmOnServer: () => Promise<ServerConfirmationResult>,
  receiptError: unknown,
): Promise<BroadcastConfirmationOutcome> {
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
