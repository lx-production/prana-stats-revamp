import { accountFromSuccessfulRefetch } from '../../web3/accountRefetch.ts';
import { confirmReceiptWithAccountSync } from '../../web3/confirmReceiptWithAccountSync.ts';

import type { Address, Hex } from '../../../types/blockchain.types.ts';
import type { BondWaitReceiptResult } from './bondTransactionConfirmation.ts';
import type { BondingAccount, BondingTransactionConfirmation } from '../bonding.types.ts';
import type {
  ConfirmReceiptWithAccountSyncOutcome,
} from '../../web3/confirmReceiptWithAccountSync.types.ts';

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
  refetchAccount: () => Promise<unknown>;
  /**
   * Resume / reload path — browser receipt success still needs server
   * sender/target/calldata validation before UI reports confirmed.
   */
  requireServerValidation?: boolean;
};

export type ConfirmBondReceiptOutcome = ConfirmReceiptWithAccountSyncOutcome;

/**
 * Bonding adapter over shared confirm + account sync.
 * Account sync failures after a good receipt are non-fatal.
 */
export async function confirmBondReceipt(
  hash: Hex,
  deps: ConfirmBondReceiptDeps,
): Promise<ConfirmBondReceiptOutcome> {
  return confirmReceiptWithAccountSync({
    hash,
    waitForReceipt: deps.waitForReceipt,
    confirmOnServer: deps.confirmOnServer,
    refetchAccount: deps.refetchAccount,
    requireServerValidation: deps.requireServerValidation,
    isSuccessfulRefetch: (refreshed) =>
      accountFromSuccessfulRefetch<BondingAccount>(refreshed) != null,
  });
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
  /**
   * Optional create-path preflight (`simulateContract`).
   * Approve/claim omit this and rely on wallet gas estimation + contract revert.
   */
  simulate?: () => Promise<SimulatedBondWrite>;
  /**
   * Broadcast. Receives the simulate result when simulate ran; otherwise
   * undefined (caller builds writeContract args itself).
   */
  write: (simulated?: SimulatedBondWrite) => Promise<Hex>;
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
 * Fresh-account gate → optional simulate → write → confirm receipt.
 * Separates pre-broadcast failures (retry write) from post-broadcast
 * confirmation failures (retry wait only, never a second write).
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

  // Create path only — approve/claim skip explicit simulation.
  let simulated: SimulatedBondWrite | undefined;
  if (deps.simulate) {
    try {
      simulated = await deps.simulate();
    } catch (error) {
      return { kind: 'simulate_failed', error };
    }
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
