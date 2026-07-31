import type { Address, Hex } from '../../../types/blockchain.types.ts';
import type {
  BondingTransactionActionSnapshot,
  BondingTxActionKind,
  PendingBondTransaction,
} from '../bonding.types.ts';

/** Drop stale pending records after one day. */
export const PENDING_BOND_TX_TTL_MS = 24 * 60 * 60 * 1000;

const STORAGE_PREFIX = 'prana:bonding:pending:v1';
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Minimal storage surface — browser localStorage or an in-memory test double. */
export type BondPendingStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function getBrowserLocalStorage(): BondPendingStorage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    // Private mode / blocked storage — treat as unavailable.
    return null;
  }
}

/** One pending record per account + chain. */
export function pendingBondTransactionStorageKey(
  account: Address,
  chainId: number,
): string {
  return `${STORAGE_PREFIX}:${chainId}:${account.toLowerCase()}`;
}

/** Build a fresh pending record at broadcast time. */
export function buildPendingBondTransaction(input: {
  account: Address;
  chainId: number;
  hash: Hex;
  action: BondingTransactionActionSnapshot;
  nowMs?: number;
}): PendingBondTransaction {
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
export function pendingBondTransactionMatchesWallet(
  pending: PendingBondTransaction,
  account: Address | undefined,
  chainId: number | undefined,
): boolean {
  if (!account || chainId == null) return false;
  return (
    pending.account.toLowerCase() === account.toLowerCase() &&
    pending.chainId === chainId
  );
}

export function savePendingBondTransaction(
  pending: PendingBondTransaction,
  storage: BondPendingStorage | null = getBrowserLocalStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(
      pendingBondTransactionStorageKey(pending.account, pending.chainId),
      JSON.stringify(pending),
    );
  } catch {
    // Quota / security errors — in-memory pending still works for the session.
  }
}

export function clearPendingBondTransaction(
  account: Address,
  chainId: number,
  storage: BondPendingStorage | null = getBrowserLocalStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(pendingBondTransactionStorageKey(account, chainId));
  } catch {
    // Ignore storage failures on clear.
  }
}

/**
 * Load a pending record for this account/chain.
 * Rejects expired, malformed, or identity-mismatched payloads.
 * Optional `kinds` filters which action owners may claim the record.
 */
export function loadPendingBondTransaction(
  account: Address,
  chainId: number,
  kinds?: readonly BondingTxActionKind[],
  storage: BondPendingStorage | null = getBrowserLocalStorage(),
  nowMs: number = Date.now(),
): PendingBondTransaction | null {
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(pendingBondTransactionStorageKey(account, chainId));
  } catch {
    return null;
  }
  if (!raw) return null;

  const parsed = parsePendingBondTransaction(raw, nowMs);
  if (!parsed) {
    clearPendingBondTransaction(account, chainId, storage);
    return null;
  }

  // Stored under the wrong identity — never surface it.
  if (!pendingBondTransactionMatchesWallet(parsed, account, chainId)) {
    clearPendingBondTransaction(account, chainId, storage);
    return null;
  }

  if (kinds && !kinds.includes(parsed.action.kind)) {
    return null;
  }

  return parsed;
}

/** Validate JSON from storage — untrusted input. */
export function parsePendingBondTransaction(
  raw: string,
  nowMs: number = Date.now(),
): PendingBondTransaction | null {
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
  if (nowMs - record.createdAt > PENDING_BOND_TX_TTL_MS) {
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
): BondingTransactionActionSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const action = value as Record<string, unknown>;

  if (action.kind === 'approve') {
    if (action.side !== 'buy' && action.side !== 'sell') return null;
    if (typeof action.amountRaw !== 'string' || !isUnsignedDecimal(action.amountRaw)) {
      return null;
    }
    return {
      kind: 'approve',
      side: action.side,
      amountRaw: action.amountRaw,
    };
  }

  if (action.kind === 'create') {
    if (action.side !== 'buy' && action.side !== 'sell') return null;
    if (action.version !== 'v2') return null;
    if (
      action.mode !== 'buy_exact_wbtc' &&
      action.mode !== 'sell_exact_prana'
    ) {
      return null;
    }
    if (action.side === 'buy' && action.mode !== 'buy_exact_wbtc') return null;
    if (action.side === 'sell' && action.mode !== 'sell_exact_prana') return null;
    if (typeof action.amountRaw !== 'string' || !isUnsignedDecimal(action.amountRaw)) {
      return null;
    }
    if (
      typeof action.termId !== 'number' ||
      !Number.isInteger(action.termId) ||
      action.termId < 0 ||
      action.termId > 4
    ) {
      return null;
    }
    return {
      kind: 'create',
      side: action.side,
      version: 'v2',
      mode: action.mode,
      amountRaw: action.amountRaw,
      termId: action.termId as 0 | 1 | 2 | 3 | 4,
    };
  }

  if (action.kind === 'claim') {
    if (action.side !== 'buy' && action.side !== 'sell') return null;
    if (action.version !== 'v1' && action.version !== 'v2') return null;
    if (typeof action.bondId !== 'string' || !isUnsignedDecimal(action.bondId)) {
      return null;
    }
    return {
      kind: 'claim',
      side: action.side,
      version: action.version,
      bondId: action.bondId,
    };
  }

  return null;
}

function isUnsignedDecimal(value: string): boolean {
  return /^[0-9]+$/.test(value);
}
