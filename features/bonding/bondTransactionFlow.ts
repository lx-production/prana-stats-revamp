import { accountFromSuccessfulRefetch } from './accountRefetch.ts';
import { confirmBondTransaction } from './utils/bondTransactionConfirmation.ts';

import type { Address, Hex } from '../../types/blockchain.types.ts';
import type {
  BondingAccount,
  BondingTransactionActionSnapshot,
  BondingTransactionConfirmation,
} from './bonding.types.ts';
import type { BondWaitReceiptResult } from './utils/bondTransactionConfirmation.ts';

/** What the primary CTA should do on the next click. */
export type BondCtaAction =
  | 'resume_confirmation'
  | 'approve'
  | 'open_review'
  | 'create';

/**
 * Pending hash always resumes confirmation only — never a second write.
 * Approve and create stay on separate user-driven clicks.
 */
export function resolveBondCtaAction(input: {
  hasPendingHash: boolean;
  needsApproval: boolean;
  /** True when the review dialog is open and user confirmed create. */
  createRequested: boolean;
}): BondCtaAction {
  if (input.hasPendingHash) return 'resume_confirmation';
  if (input.needsApproval) return 'approve';
  if (input.createRequested) return 'create';
  return 'open_review';
}

export type ConfirmBondReceiptDeps = {
  waitForReceipt: (hash: Hex) => Promise<BondWaitReceiptResult>;
  confirmOnServer: (
    hash: Hex,
  ) => Promise<BondingTransactionConfirmation>;
  refetchAccount: () => Promise<unknown>;
};

export type ConfirmBondReceiptOutcome =
  | { kind: 'confirmed'; syncFailed: boolean; source: 'browser' | 'server' }
  | { kind: 'reverted'; source: 'browser' | 'server' }
  | {
      kind: 'confirmation_unavailable';
      receiptError: unknown;
      verificationError: unknown;
    };

/**
 * Wait for an already-broadcast hash (browser → server). Account sync failures
 * after a good receipt are non-fatal so callers keep transaction success.
 */
export async function confirmBondReceipt(
  hash: Hex,
  deps: ConfirmBondReceiptDeps,
): Promise<ConfirmBondReceiptOutcome> {
  const confirmation = await confirmBondTransaction({
    waitForReceipt: () => deps.waitForReceipt(hash),
    confirmOnServer: () => deps.confirmOnServer(hash),
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
    if (!accountFromSuccessfulRefetch(refreshed)) {
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

export type SimulatedBondWrite = {
  address: Address;
  functionName: string;
  args: readonly unknown[];
  account: Address;
  /** Optional viem simulate request to pass straight into writeContract. */
  request?: unknown;
};

export type SubmitBondWriteDeps = {
  refetchAccount: () => Promise<unknown>;
  /** Return false when form/account no longer matches the intended write. */
  validateFreshAccount: (account: BondingAccount) => boolean;
  /** Simulate first — must not call write when this throws. */
  simulate: () => Promise<SimulatedBondWrite>;
  /** Broadcast the simulated request. Returns the tx hash. */
  write: (simulated: SimulatedBondWrite) => Promise<Hex>;
  waitForReceipt: (hash: Hex) => Promise<BondWaitReceiptResult>;
  confirmOnServer: (
    hash: Hex,
  ) => Promise<BondingTransactionConfirmation>;
};

export type SubmitBondWriteOutcome =
  | { kind: 'fresh_account_failed' }
  | { kind: 'validation_failed' }
  | { kind: 'simulate_failed'; error: unknown }
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
      syncFailed: boolean;
      source: 'browser' | 'server';
    };

/**
 * Fresh-account gate → simulate → write → confirm receipt.
 * Separates pre-broadcast failures (retry write) from post-broadcast
 * confirmation failures (retry wait only, never a second write).
 */
export async function submitBondWriteFlow(
  deps: SubmitBondWriteDeps,
): Promise<SubmitBondWriteOutcome> {
  const refreshed = await deps.refetchAccount();
  const account = accountFromSuccessfulRefetch(refreshed);
  if (!account) {
    return { kind: 'fresh_account_failed' };
  }

  if (!deps.validateFreshAccount(account)) {
    return { kind: 'validation_failed' };
  }

  let simulated: SimulatedBondWrite;
  try {
    simulated = await deps.simulate();
  } catch (error) {
    return { kind: 'simulate_failed', error };
  }

  let hash: Hex;
  try {
    hash = await deps.write(simulated);
  } catch (error) {
    return { kind: 'rejected_before_broadcast', error };
  }

  const confirm = await confirmBondReceipt(hash, {
    waitForReceipt: deps.waitForReceipt,
    confirmOnServer: deps.confirmOnServer,
    refetchAccount: deps.refetchAccount,
  });

  if (confirm.kind === 'confirmed') {
    return {
      kind: 'confirmed',
      hash,
      syncFailed: confirm.syncFailed,
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
 * Orchestrate resume / approve / review / create as separate user actions.
 * Returns which branch ran — used to assert one click never chains approve+create.
 */
export async function runBondCtaBranch(options: {
  action: BondCtaAction;
  resumeConfirmation: () => Promise<void>;
  runApprove: () => Promise<void>;
  openReview: () => Promise<void>;
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
    default:
      await options.openReview();
      return 'open_review';
  }
}

/** Keep action snapshot + hash together for confirmation resume. */
export type PendingBondTransaction = {
  hash: Hex;
  action: BondingTransactionActionSnapshot;
};
