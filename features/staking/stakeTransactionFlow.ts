import { accountFromSuccessfulRefetch } from './accountRefetch.ts';

import type { Hex } from '../../types/blockchain.types.ts';
import type { StakingAccountSnapshot } from './staking.types.ts';

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

export type WaitReceiptResult = { status: 'success' | 'reverted' };

export type ConfirmStakeDeps = {
  waitForReceipt: (hash: Hex) => Promise<WaitReceiptResult>;
  refetchAccount: () => Promise<unknown>;
};

export type ConfirmStakeOutcome =
  | { kind: 'confirmed'; syncFailed: boolean }
  | { kind: 'reverted' }
  | { kind: 'receipt_pending'; error: unknown };

/**
 * Wait for an already-broadcast hash. Account sync failures after a good
 * receipt are non-fatal (syncFailed) so callers keep transaction success.
 */
export async function confirmStakeReceipt(
  hash: Hex,
  deps: ConfirmStakeDeps,
): Promise<ConfirmStakeOutcome> {
  try {
    const receipt = await deps.waitForReceipt(hash);
    if (receipt.status === 'reverted') {
      return { kind: 'reverted' };
    }
  } catch (error) {
    return { kind: 'receipt_pending', error };
  }

  // Receipt succeeded — sync account without turning success into error.
  try {
    const refreshed = await deps.refetchAccount();
    if (!accountFromSuccessfulRefetch(refreshed)) {
      return { kind: 'confirmed', syncFailed: true };
    }
    return { kind: 'confirmed', syncFailed: false };
  } catch {
    return { kind: 'confirmed', syncFailed: true };
  }
}

export type SubmitStakeDeps = {
  refetchAccount: () => Promise<unknown>;
  writeContract: () => Promise<Hex>;
  waitForReceipt: (hash: Hex) => Promise<WaitReceiptResult>;
  /** Return false when permit no longer matches the fresh account/form. */
  isPermitStillValid: (account: StakingAccountSnapshot) => boolean;
  /** True when the permit deadline has passed (for error copy). */
  isPermitExpired: () => boolean;
};

export type SubmitStakeOutcome =
  | { kind: 'fresh_account_failed' }
  | { kind: 'invalid_permit'; expired: boolean }
  | { kind: 'rejected_before_broadcast'; error: unknown }
  | { kind: 'broadcast_receipt_pending'; hash: Hex; error: unknown }
  | { kind: 'reverted'; hash: Hex }
  | { kind: 'confirmed'; hash: Hex; syncFailed: boolean };

/**
 * Fresh-account gate → writeContract → confirm receipt.
 * Separates pre-broadcast failures (retry with same permit) from post-broadcast
 * receipt failures (retry wait only, never a second write).
 */
export async function submitStakeWithPermitFlow(
  deps: SubmitStakeDeps,
): Promise<SubmitStakeOutcome> {
  const refreshed = await deps.refetchAccount();
  const account = accountFromSuccessfulRefetch(refreshed);
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
    refetchAccount: deps.refetchAccount,
  });

  if (confirm.kind === 'confirmed') {
    return {
      kind: 'confirmed',
      hash,
      syncFailed: confirm.syncFailed,
    };
  }
  if (confirm.kind === 'reverted') {
    return { kind: 'reverted', hash };
  }
  return {
    kind: 'broadcast_receipt_pending',
    hash,
    error: confirm.error,
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
