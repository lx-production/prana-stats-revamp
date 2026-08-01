import { PENDING_TX_TTL_MS, createPendingTransactionStorage } from '../../web3/pendingTransactionStorage.ts';

import type { Hex } from '../../../types/blockchain.types.ts';
import type { PendingStorage } from '../../web3/pendingTransactionStorage.types.ts';
import type { PendingStakeTransaction, StakeActionKind, StakingTransactionActionSnapshot, StakingTxActionKind } from '../staking.types.ts';

/** Drop stale pending records after one day. */
export const PENDING_STAKE_TX_TTL_MS = PENDING_TX_TTL_MS;

/** Alias of shared PendingStorage — kept for existing imports. */
export type StakePendingStorage = PendingStorage;

const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const MAX_UINT32 = 0xffff_ffff;

const STAKE_ACTION_KINDS: readonly StakeActionKind[] = [
  'claim',
  'unstake',
  'unstakeEarly',
];

/** Feature-local action parser — permit fields + stakeId actions. */
function parseStoredStakeAction(
  value: unknown,
): StakingTransactionActionSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const action = value as Record<string, unknown>;

  if (action.kind === 'stake') {
    if (typeof action.amountRaw !== 'string' || !isUnsignedDecimal(action.amountRaw)) {
      return null;
    }
    if (
      typeof action.durationSeconds !== 'number' ||
      !Number.isInteger(action.durationSeconds) ||
      action.durationSeconds <= 0
    ) {
      return null;
    }
    if (
      typeof action.deadline !== 'number' ||
      !Number.isInteger(action.deadline) ||
      action.deadline <= 0
    ) {
      return null;
    }
    if (
      typeof action.v !== 'number' ||
      !Number.isInteger(action.v) ||
      action.v < 0 ||
      action.v > 255
    ) {
      return null;
    }
    if (typeof action.r !== 'string' || !BYTES32_RE.test(action.r)) {
      return null;
    }
    if (typeof action.s !== 'string' || !BYTES32_RE.test(action.s)) {
      return null;
    }
    return {
      kind: 'stake',
      amountRaw: action.amountRaw,
      durationSeconds: action.durationSeconds,
      deadline: action.deadline,
      v: action.v,
      r: action.r as Hex,
      s: action.s as Hex,
    };
  }

  if (
    typeof action.kind === 'string' &&
    STAKE_ACTION_KINDS.includes(action.kind as StakeActionKind)
  ) {
    if (
      typeof action.stakeId !== 'number' ||
      !Number.isInteger(action.stakeId) ||
      action.stakeId < 0 ||
      action.stakeId > MAX_UINT32
    ) {
      return null;
    }
    return {
      kind: action.kind as StakeActionKind,
      stakeId: action.stakeId,
    };
  }

  return null;
}

function isUnsignedDecimal(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

const stakePendingStorage = createPendingTransactionStorage<StakingTransactionActionSnapshot>({
  storagePrefix: 'prana:staking:pending:v1',
  ttlMs: PENDING_STAKE_TX_TTL_MS,
  parseAction: parseStoredStakeAction,
});

/** One pending record per account + chain. */
export const pendingStakeTransactionStorageKey = stakePendingStorage.storageKey;

/** Build a fresh pending record at broadcast time. */
export function buildPendingStakeTransaction(
  ...args: Parameters<typeof stakePendingStorage.buildPendingTransaction>
): PendingStakeTransaction {
  return stakePendingStorage.buildPendingTransaction(...args);
}

/** True when wallet identity still matches the submitting account/chain. */
export const pendingStakeTransactionMatchesWallet =
  stakePendingStorage.matchesWallet;

export function savePendingStakeTransaction(
  pending: PendingStakeTransaction,
  storage?: PendingStorage | null,
): void {
  stakePendingStorage.save(pending, storage);
}

export function clearPendingStakeTransaction(
  ...args: Parameters<typeof stakePendingStorage.clear>
): void {
  stakePendingStorage.clear(...args);
}

/**
 * Load a pending record for this account/chain.
 * Rejects expired, malformed, or identity-mismatched payloads.
 * Optional `kinds` filters which action owners may claim the record.
 */
export function loadPendingStakeTransaction(
  account: Parameters<typeof stakePendingStorage.load>[0],
  chainId: Parameters<typeof stakePendingStorage.load>[1],
  kinds?: readonly StakingTxActionKind[],
  storage?: PendingStorage | null,
  nowMs?: number,
): PendingStakeTransaction | null {
  return stakePendingStorage.load(account, chainId, kinds, storage, nowMs);
}

/** Validate JSON from storage — untrusted input. */
export function parsePendingStakeTransaction(
  ...args: Parameters<typeof stakePendingStorage.parse>
): PendingStakeTransaction | null {
  return stakePendingStorage.parse(...args);
}
