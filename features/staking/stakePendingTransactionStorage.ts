import type { Address, Hex } from '../../types/blockchain.types.ts';
import type {
  PendingStakeTransaction,
  StakeActionKind,
  StakingTransactionActionSnapshot,
  StakingTxActionKind,
} from './staking.types.ts';

/** Drop stale pending records after one day. */
export const PENDING_STAKE_TX_TTL_MS = 24 * 60 * 60 * 1000;

const STORAGE_PREFIX = 'prana:staking:pending:v1';
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const MAX_UINT32 = 0xffff_ffff;

const STAKE_ACTION_KINDS: readonly StakeActionKind[] = [
  'claim',
  'unstake',
  'unstakeEarly',
];

/** Minimal storage surface — browser localStorage or an in-memory test double. */
export type StakePendingStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function getBrowserLocalStorage(): StakePendingStorage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    // Private mode / blocked storage — treat as unavailable.
    return null;
  }
}

/** One pending record per account + chain. */
export function pendingStakeTransactionStorageKey(
  account: Address,
  chainId: number,
): string {
  return `${STORAGE_PREFIX}:${chainId}:${account.toLowerCase()}`;
}

/** Build a fresh pending record at broadcast time. */
export function buildPendingStakeTransaction(input: {
  account: Address;
  chainId: number;
  hash: Hex;
  action: StakingTransactionActionSnapshot;
  nowMs?: number;
}): PendingStakeTransaction {
  return {
    version: 1,
    chainId: input.chainId,
    account: input.account,
    hash: input.hash,
    action: input.action,
    createdAt: input.nowMs ?? Date.now(),
  };
}

/** True when wallet identity still matches the submitting account/chain. */
export function pendingStakeTransactionMatchesWallet(
  pending: PendingStakeTransaction,
  account: Address | undefined,
  chainId: number | undefined,
): boolean {
  if (!account || chainId == null) return false;
  return (
    pending.account.toLowerCase() === account.toLowerCase() &&
    pending.chainId === chainId
  );
}

export function savePendingStakeTransaction(
  pending: PendingStakeTransaction,
  storage: StakePendingStorage | null = getBrowserLocalStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(
      pendingStakeTransactionStorageKey(pending.account, pending.chainId),
      JSON.stringify(pending),
    );
  } catch {
    // Quota / security errors — in-memory pending still works for the session.
  }
}

export function clearPendingStakeTransaction(
  account: Address,
  chainId: number,
  storage: StakePendingStorage | null = getBrowserLocalStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(pendingStakeTransactionStorageKey(account, chainId));
  } catch {
    // Ignore storage failures on clear.
  }
}

/**
 * Load a pending record for this account/chain.
 * Rejects expired, malformed, or identity-mismatched payloads.
 * Optional `kinds` filters which action owners may claim the record.
 */
export function loadPendingStakeTransaction(
  account: Address,
  chainId: number,
  kinds?: readonly StakingTxActionKind[],
  storage: StakePendingStorage | null = getBrowserLocalStorage(),
  nowMs: number = Date.now(),
): PendingStakeTransaction | null {
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(pendingStakeTransactionStorageKey(account, chainId));
  } catch {
    return null;
  }
  if (!raw) return null;

  const parsed = parsePendingStakeTransaction(raw, nowMs);
  if (!parsed) {
    clearPendingStakeTransaction(account, chainId, storage);
    return null;
  }

  // Stored under the wrong identity — never surface it.
  if (!pendingStakeTransactionMatchesWallet(parsed, account, chainId)) {
    clearPendingStakeTransaction(account, chainId, storage);
    return null;
  }

  if (kinds && !kinds.includes(parsed.action.kind)) {
    return null;
  }

  return parsed;
}

/** Validate JSON from storage — untrusted input. */
export function parsePendingStakeTransaction(
  raw: string,
  nowMs: number = Date.now(),
): PendingStakeTransaction | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;

  if (record.version !== 1) return null;
  if (typeof record.chainId !== 'number' || !Number.isInteger(record.chainId)) {
    return null;
  }
  if (typeof record.account !== 'string' || !ADDRESS_RE.test(record.account)) {
    return null;
  }
  if (typeof record.hash !== 'string' || !TX_HASH_RE.test(record.hash)) {
    return null;
  }
  if (
    typeof record.createdAt !== 'number' ||
    !Number.isFinite(record.createdAt)
  ) {
    return null;
  }
  if (nowMs - record.createdAt > PENDING_STAKE_TX_TTL_MS) {
    return null;
  }
  if (record.createdAt > nowMs + 60_000) {
    // Far-future timestamps are treated as corrupt.
    return null;
  }

  const action = parseStoredAction(record.action);
  if (!action) return null;

  return {
    version: 1,
    chainId: record.chainId,
    account: record.account as Address,
    hash: record.hash as Hex,
    action,
    createdAt: record.createdAt,
  };
}

function parseStoredAction(
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
