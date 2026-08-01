import {
  PENDING_TX_TTL_MS,
  createPendingTransactionStorage,
} from '../../web3/pendingTransactionStorage.ts';

import type { PendingStorage } from '../../web3/pendingTransactionStorage.types.ts';
import type {
  BondingTransactionActionSnapshot,
  BondingTxActionKind,
  PendingBondTransaction,
} from '../bonding.types.ts';

/** Drop stale pending records after one day. */
export const PENDING_BOND_TX_TTL_MS = PENDING_TX_TTL_MS;

/** Alias of shared PendingStorage — kept for existing imports. */
export type BondPendingStorage = PendingStorage;

/** Feature-local action parser — approve / create / claim shapes. */
function parseStoredBondAction(
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

const bondPendingStorage = createPendingTransactionStorage<BondingTransactionActionSnapshot>({
  storagePrefix: 'prana:bonding:pending:v1',
  ttlMs: PENDING_BOND_TX_TTL_MS,
  parseAction: parseStoredBondAction,
});

/** One pending record per account + chain. */
export const pendingBondTransactionStorageKey = bondPendingStorage.storageKey;

/** Build a fresh pending record at broadcast time. */
export function buildPendingBondTransaction(
  ...args: Parameters<typeof bondPendingStorage.buildPendingTransaction>
): PendingBondTransaction {
  return bondPendingStorage.buildPendingTransaction(...args);
}

/** True when wallet identity still matches the submitting account/chain. */
export const pendingBondTransactionMatchesWallet =
  bondPendingStorage.matchesWallet;

export function savePendingBondTransaction(
  pending: PendingBondTransaction,
  storage?: PendingStorage | null,
): void {
  bondPendingStorage.save(pending, storage);
}

export function clearPendingBondTransaction(
  ...args: Parameters<typeof bondPendingStorage.clear>
): void {
  bondPendingStorage.clear(...args);
}

/**
 * Load a pending record for this account/chain.
 * Rejects expired, malformed, or identity-mismatched payloads.
 * Optional `kinds` filters which action owners may claim the record.
 */
export function loadPendingBondTransaction(
  account: Parameters<typeof bondPendingStorage.load>[0],
  chainId: Parameters<typeof bondPendingStorage.load>[1],
  kinds?: readonly BondingTxActionKind[],
  storage?: PendingStorage | null,
  nowMs?: number,
): PendingBondTransaction | null {
  return bondPendingStorage.load(account, chainId, kinds, storage, nowMs);
}

/** Validate JSON from storage — untrusted input. */
export function parsePendingBondTransaction(
  ...args: Parameters<typeof bondPendingStorage.parse>
): PendingBondTransaction | null {
  return bondPendingStorage.parse(...args);
}
