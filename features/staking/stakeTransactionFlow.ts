import { accountFromSuccessfulRefetch } from '../web3/accountRefetch.ts';
import { confirmReceiptWithAccountSync } from '../web3/confirmReceiptWithAccountSync.ts';

import type { Hex } from '../../types/blockchain.types.ts';
import type { StakeWaitReceiptResult } from './stakeTransactionConfirmation.ts';
import type { ConfirmReceiptWithAccountSyncOutcome } from '../web3/confirmReceiptWithAccountSync.types.ts';
import type {
  StakingAccountSnapshot,
  StakingTransactionConfirmation,
} from './staking.types.ts';

/** What the combined CTA should do on the next click. */
export type PermitAndStakeAction =
  | 'resume_receipt'
  | 'continue_with_permit'
  | 'create_permit_and_stake';

/**
 * After broadcast (and before confirmed success), always resume receipt wait —
 * never open a second write. Permit retry is only allowed before writeContract
 * returns a hash.
 */
export function resolvePermitAndStakeAction(input: {
  hasPendingHash: boolean;
  hasValidPermit: boolean;
}): PermitAndStakeAction {
  if (input.hasPendingHash) return 'resume_receipt';
  if (input.hasValidPermit) return 'continue_with_permit';
  return 'create_permit_and_stake';
}

export type ConfirmStakeDeps = {
  waitForReceipt: (hash: Hex) => Promise<StakeWaitReceiptResult>;
  confirmOnServer: (
    hash: Hex,
  ) => Promise<StakingTransactionConfirmation>;
  refetchAccount: () => Promise<unknown>;
  /**
   * Resume / reload path — browser receipt success still needs server
   * sender/target/calldata validation before UI reports confirmed.
   */
  requireServerValidation?: boolean;
};

export type ConfirmStakeOutcome = ConfirmReceiptWithAccountSyncOutcome;

/**
 * Staking adapter over shared confirm + account sync.
 * Account sync failures after a good receipt are non-fatal.
 */
export async function confirmStakeReceipt(
  hash: Hex,
  deps: ConfirmStakeDeps,
): Promise<ConfirmStakeOutcome> {
  return confirmReceiptWithAccountSync({
    hash,
    waitForReceipt: deps.waitForReceipt,
    confirmOnServer: deps.confirmOnServer,
    refetchAccount: deps.refetchAccount,
    requireServerValidation: deps.requireServerValidation,
    isSuccessfulRefetch: (refreshed) =>
      accountFromSuccessfulRefetch<StakingAccountSnapshot>(refreshed) != null,
  });
}

export type SubmitStakeDeps = {
  refetchAccount: () => Promise<unknown>;
  writeContract: () => Promise<Hex>;
  waitForReceipt: (hash: Hex) => Promise<StakeWaitReceiptResult>;
  confirmOnServer: (
    hash: Hex,
  ) => Promise<StakingTransactionConfirmation>;
  /** Return false when permit no longer matches the fresh account/form. */
  isPermitStillValid: (account: StakingAccountSnapshot) => boolean;
  /** True when the permit deadline has passed (for error copy). */
  isPermitExpired: () => boolean;
};

export type SubmitStakeOutcome =
  | { kind: 'fresh_account_failed' }
  | { kind: 'invalid_permit'; expired: boolean }
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
 * Fresh-account gate → writeContract → confirm receipt.
 * Separates pre-broadcast failures (retry with same permit) from post-broadcast
 * confirmation failures (retry wait only, never a second write).
 */
export async function submitStakeWithPermitFlow(
  deps: SubmitStakeDeps,
): Promise<SubmitStakeOutcome> {
  const refreshed = await deps.refetchAccount();
  const account = accountFromSuccessfulRefetch<StakingAccountSnapshot>(
    refreshed,
  );
  if (!account) {
    return { kind: 'fresh_account_failed' };
  }

  if (!deps.isPermitStillValid(account)) {
    return {
      kind: 'invalid_permit',
      expired: deps.isPermitExpired(),
    };
  }

  let hash: Hex;
  try {
    hash = await deps.writeContract();
  } catch (error) {
    return { kind: 'rejected_before_broadcast', error };
  }

  const confirm = await confirmStakeReceipt(hash, {
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
 * Orchestrate resume / reuse-permit / create-permit then submit.
 * Returns whether submit ran — used to assert reject-permit never writes.
 */
export async function runPermitThenStake<TPermit>(options: {
  action: PermitAndStakeAction;
  existingPermit: TPermit | null;
  createPermit: () => Promise<TPermit | null>;
  submit: (permit: TPermit) => Promise<void>;
  resumeReceipt: () => Promise<void>;
}): Promise<'resumed' | 'submitted' | 'stopped'> {
  if (options.action === 'resume_receipt') {
    await options.resumeReceipt();
    return 'resumed';
  }

  const permit =
    options.action === 'continue_with_permit'
      ? options.existingPermit
      : await options.createPermit();

  if (!permit) return 'stopped';

  await options.submit(permit);
  return 'submitted';
}
