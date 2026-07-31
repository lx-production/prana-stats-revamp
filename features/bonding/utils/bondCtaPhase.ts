import type { BondCtaPhase, BondTransactionStatus } from '../bonding.types.ts';

/**
 * Map tx status + allowance / pending-hash to the single CTA phase.
 * Busy / pending-hash win so the UI never implies a second write after broadcast.
 */
export function getBondCtaPhase(
  status: BondTransactionStatus,
  needsApproval: boolean,
  hasPendingHash = false,
): BondCtaPhase {
  if (status === 'confirming') return 'confirming';
  if (status === 'success') return 'success';
  if (status === 'confirmation_unavailable') return 'confirmation_unavailable';
  if (hasPendingHash) return 'confirmation_unavailable';
  if (status === 'approving') return 'approve';
  if (status === 'submitting') return 'create';
  if (status === 'reviewing') return 'create';
  if (needsApproval) return 'approve';
  if (status === 'error') {
    return needsApproval ? 'approve' : 'review';
  }
  return 'review';
}
