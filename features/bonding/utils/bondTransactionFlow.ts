import { accountFromSuccessfulRefetch } from '../../web3/accountRefetch.ts';
import { confirmBondTransaction } from './bondTransactionConfirmation.ts';

import type { Hex } from '../../../types/blockchain.types.ts';
import type { BondConfirmationOutcome, BondWaitReceiptResult } from './bondTransactionConfirmation.ts';
import type { BondingAccount, BondingTransactionConfirmation } from '../bonding.types.ts';

/** What the primary CTA should do on the next click. */
export type BondCtaAction =
  | 'resume_confirmation'
  | 'approve'
  | 'create';

/**
 * Pending hash always resumes confirmation only — never a second write.
 * Approve and create stay on separate user-driven clicks.
 */
export function resolveBondCtaAction(input: {
  hasPendingHash: boolean;
  needsApproval: boolean;
}): BondCtaAction {
  if (input.hasPendingHash) return 'resume_confirmation';
  if (input.needsApproval) return 'approve';
  return 'create';
}

export type ConfirmBondReceiptDeps = {
  waitForReceipt: (hash: Hex) => Promise<BondWaitReceiptResult>;
  confirmOnServer: (
    hash: Hex,
  ) => Promise<BondingTransactionConfirmation>;
  /**
   * Resume / reload path — browser receipt success still needs server
   * sender/target/calldata validation before UI reports confirmed.
   */
  requireServerValidation?: boolean;
};

export type ConfirmBondReceiptOutcome = BondConfirmationOutcome;

/**
 * Wait for an already-broadcast bond hash (browser → server).
 * Account sync is intentionally separate so UI can show success immediately.
 */
export async function confirmBondReceipt(
  hash: Hex,
  deps: ConfirmBondReceiptDeps,
): Promise<ConfirmBondReceiptOutcome> {
  return confirmBondTransaction({
    waitForReceipt: () => deps.waitForReceipt(hash),
    confirmOnServer: () => deps.confirmOnServer(hash),
    requireServerValidation: deps.requireServerValidation,
  });
}

export type SubmitBondWriteDeps = {
  refetchAccount: () => Promise<unknown>;
  /** Return false when form/account no longer matches the intended write. */
  validateFreshAccount: (account: BondingAccount) => boolean;
  /**
   * Broadcast writeContract / send. No explicit simulateContract —
   * wallet gas estimation + contract revert are the pre-execution safeguards.
   */
  write: () => Promise<Hex>;
  waitForReceipt: (hash: Hex) => Promise<BondWaitReceiptResult>;
  confirmOnServer: (
    hash: Hex,
  ) => Promise<BondingTransactionConfirmation>;
};

export type SubmitBondWriteOutcome =
  | { kind: 'fresh_account_failed' }
  | { kind: 'validation_failed' }
  | { kind: 'rejected_before_broadcast'; error: unknown }
  | {
      kind: 'confirmation_unavailable';
      hash: Hex;
      receiptError: unknown;
      verificationError: unknown;
    }
  | { kind: 'reverted'; hash: Hex; source: 'browser' | 'server' }
  | {
      kind: 'confirmed';
      hash: Hex;
      source: 'browser' | 'server';
    };

/**
 * Fresh-account gate → write → confirm receipt.
 * Separates pre-broadcast failures (retry write) from post-broadcast
 * confirmation failures (retry wait only, never a second write).
 * Does not refetch account after receipt — callers sync in the background.
 */
export async function submitBondWriteFlow(
  deps: SubmitBondWriteDeps,
): Promise<SubmitBondWriteOutcome> {
  const refreshed = await deps.refetchAccount();
  const account = accountFromSuccessfulRefetch<BondingAccount>(refreshed);
  if (!account) {
    return { kind: 'fresh_account_failed' };
  }

  if (!deps.validateFreshAccount(account)) {
    return { kind: 'validation_failed' };
  }

  let hash: Hex;
  try {
    hash = await deps.write();
  } catch (error) {
    return { kind: 'rejected_before_broadcast', error };
  }

  // Receipt only — account sync happens after the UI shows success.
  const confirm = await confirmBondReceipt(hash, {
    waitForReceipt: deps.waitForReceipt,
    confirmOnServer: deps.confirmOnServer,
  });

  if (confirm.kind === 'confirmed') {
    return {
      kind: 'confirmed',
      hash,
      source: confirm.source,
    };
  }
  if (confirm.kind === 'reverted') {
    return { kind: 'reverted', hash, source: confirm.source };
  }
  return {
    kind: 'confirmation_unavailable',
    hash,
    receiptError: confirm.receiptError,
    verificationError: confirm.verificationError,
  };
}

/**
 * Orchestrate resume / approve / create as separate user actions.
 * Returns which branch ran — used to assert one click never chains approve+create.
 */
export async function runBondCtaBranch(options: {
  action: BondCtaAction;
  resumeConfirmation: () => Promise<void>;
  runApprove: () => Promise<void>;
  runCreate: () => Promise<void>;
}): Promise<BondCtaAction> {
  switch (options.action) {
    case 'resume_confirmation':
      await options.resumeConfirmation();
      return 'resume_confirmation';
    case 'approve':
      await options.runApprove();
      return 'approve';
    case 'create':
      await options.runCreate();
      return 'create';
  }
}
