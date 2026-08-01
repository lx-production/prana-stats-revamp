import { confirmBroadcastTransaction } from './transactionConfirmation.ts';

import type {
  ConfirmReceiptWithAccountSyncDependencies,
  ConfirmReceiptWithAccountSyncOutcome,
} from './confirmReceiptWithAccountSync.types.ts';

/**
 * Wait for an already-broadcast hash (browser → server), then sync account.
 * Account sync failures after a good receipt are non-fatal so callers keep
 * transaction success (`syncFailed: true`).
 */
export async function confirmReceiptWithAccountSync(
  deps: ConfirmReceiptWithAccountSyncDependencies,
): Promise<ConfirmReceiptWithAccountSyncOutcome> {
  const { hash } = deps;

  const confirmation = await confirmBroadcastTransaction({
    waitForReceipt: () => deps.waitForReceipt(hash),
    confirmOnServer: () => deps.confirmOnServer(hash),
    requireServerValidation: deps.requireServerValidation,
  });

  if (confirmation.kind === 'reverted') {
    return { kind: 'reverted', source: confirmation.source };
  }

  if (confirmation.kind === 'confirmation_unavailable') {
    return {
      kind: 'confirmation_unavailable',
      receiptError: confirmation.receiptError,
      verificationError: confirmation.verificationError,
    };
  }

  // Receipt succeeded — sync account without turning success into error.
  try {
    const refreshed = await deps.refetchAccount();
    if (!deps.isSuccessfulRefetch(refreshed)) {
      return {
        kind: 'confirmed',
        syncFailed: true,
        source: confirmation.source,
      };
    }
    return {
      kind: 'confirmed',
      syncFailed: false,
      source: confirmation.source,
    };
  } catch {
    return {
      kind: 'confirmed',
      syncFailed: true,
      source: confirmation.source,
    };
  }
}
