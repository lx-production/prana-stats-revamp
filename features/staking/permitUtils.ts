import type { Address } from '../../types/blockchain.types.ts';
import type { PermitSnapshot } from './staking.types.ts';

type PermitMatchInput = {
  owner: Address | undefined;
  chainId: number | undefined;
  amountRaw: string;
  durationSeconds: number;
  nowSeconds: number;
  /** When set, permit.nonce must still match the on-chain permit nonce. */
  currentNonce?: string;
};

/** True when a signed permit still matches the form and has not expired. */
export function isPermitSnapshotValid(
  permit: PermitSnapshot | null | undefined,
  input: PermitMatchInput,
): boolean {
  return getPermitInvalidReason(permit, input) === null;
}

/** Reasons a permit snapshot should be cleared (for tests + UI). */
export type PermitInvalidReason =
  | 'missing'
  | 'expired'
  | 'owner_changed'
  | 'chain_changed'
  | 'amount_changed'
  | 'duration_changed'
  | 'nonce_changed';

export function getPermitInvalidReason(
  permit: PermitSnapshot | null | undefined,
  input: PermitMatchInput,
): PermitInvalidReason | null {
  if (!permit) return 'missing';
  if (input.nowSeconds >= permit.deadline) return 'expired';
  if (!input.owner || permit.owner.toLowerCase() !== input.owner.toLowerCase()) {
    return 'owner_changed';
  }
  if (input.chainId == null || permit.chainId !== input.chainId) {
    return 'chain_changed';
  }
  if (permit.amountRaw !== input.amountRaw) return 'amount_changed';
  if (permit.durationSeconds !== input.durationSeconds) return 'duration_changed';
  if (
    input.currentNonce != null &&
    permit.nonce !== input.currentNonce
  ) {
    return 'nonce_changed';
  }
  return null;
}
