import type { StakeTransactionStatus } from './staking.types.ts';

/** Which label the single Permit & Stake CTA should show. */
export type StakeCtaPhase =
  | 'permit_and_stake'
  | 'continue_stake'
  | 'resume_confirming'
  | 'signing'
  | 'submitting'
  | 'confirming'
  | 'success';

/**
 * Map tx status + leftover permit/hash to CTA phase.
 * Busy statuses win; a pending hash beats Continue Stake so we never imply a
 * second writeContract after broadcast.
 */
export function getStakeCtaPhase(
  status: StakeTransactionStatus,
  hasValidPermit: boolean,
  hasPendingHash = false,
): StakeCtaPhase {
  if (status === 'signing') return 'signing';
  if (status === 'submitting') return 'submitting';
  if (status === 'confirming') return 'confirming';
  if (status === 'success') return 'success';
  if (hasPendingHash) return 'resume_confirming';
  if (hasValidPermit) return 'continue_stake';
  return 'permit_and_stake';
}
