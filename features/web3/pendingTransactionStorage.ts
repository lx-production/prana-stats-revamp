import type { Address, Hex } from '../../types/blockchain.types.ts';
import type {
  BuildPendingTransactionInput,
  CreatePendingTransactionStorageOptions,
  PendingStorage,
  PendingTransactionEnvelope,
  PendingTransactionStorageApi,
} from './pendingTransactionStorage.types.ts';

/** Drop stale pending records after one day (Staking + Bonding). */
export const PENDING_TX_TTL_MS = 24 * 60 * 60 * 1000;

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Resolve browser localStorage when available (private mode may throw). */
export function getBrowserLocalStorage(): PendingStorage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** In-memory PendingStorage for characterization / unit tests. */
export function createMemoryPendingStorage(): PendingStorage & {
  map: Map<string, string>;
} {
  const map = new Map<string, string>();
  return {
    map,
    getItem(key) {
      return map.get(key) ?? null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

/**
 * Factory for account+chain pending-tx persistence.
 * Envelope validation is shared; action validation stays feature-local via
 * `parseAction`. Prefix / schema version / TTL are caller-supplied and must
 * stay stable for localStorage compatibility.
 */
export function createPendingTransactionStorage<
  TAction extends { kind: string },
>(
  options: CreatePendingTransactionStorageOptions<TAction>,
): PendingTransactionStorageApi<TAction> {
  const { storagePrefix, ttlMs, parseAction } = options;

  function storageKey(account: Address, chainId: number): string {
    return `${storagePrefix}:${chainId}:${account.toLowerCase()}`;
  }

  function buildPendingTransaction(
    input: BuildPendingTransactionInput<TAction>,
  ): PendingTransactionEnvelope<TAction> {
    return {
      version: 1,
      chainId: input.chainId,
      account: input.account,
      hash: input.hash,
      action: input.action,
      createdAt: input.nowMs ?? Date.now(),
    };
  }

  function matchesWallet(
    pending: PendingTransactionEnvelope<TAction>,
    account: Address | undefined,
    chainId: number | undefined,
  ): boolean {
    if (!account || chainId == null) return false;
    return (
      pending.account.toLowerCase() === account.toLowerCase() &&
      pending.chainId === chainId
    );
  }

  function save(
    pending: PendingTransactionEnvelope<TAction>,
    storage: PendingStorage | null = getBrowserLocalStorage(),
  ): void {
    if (!storage) return;
    try {
      storage.setItem(
        storageKey(pending.account, pending.chainId),
        JSON.stringify(pending),
      );
    } catch {
      // Quota / security errors — in-memory pending still works for the session.
    }
  }

  function clear(
    account: Address,
    chainId: number,
    storage: PendingStorage | null = getBrowserLocalStorage(),
  ): void {
    if (!storage) return;
    try {
      storage.removeItem(storageKey(account, chainId));
    } catch {
      // Ignore storage failures on clear.
    }
  }

  function parse(
    raw: string,
    nowMs: number = Date.now(),
  ): PendingTransactionEnvelope<TAction> | null {
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
    if (nowMs - record.createdAt > ttlMs) {
      return null;
    }
    if (record.createdAt > nowMs + 60_000) {
      // Far-future timestamps are treated as corrupt.
      return null;
    }

    const action = parseAction(record.action);
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

  function load(
    account: Address,
    chainId: number,
    kinds?: readonly TAction['kind'][],
    storage: PendingStorage | null = getBrowserLocalStorage(),
    nowMs: number = Date.now(),
  ): PendingTransactionEnvelope<TAction> | null {
    if (!storage) return null;

    let raw: string | null;
    try {
      raw = storage.getItem(storageKey(account, chainId));
    } catch {
      return null;
    }
    if (!raw) return null;

    const parsed = parse(raw, nowMs);
    if (!parsed) {
      clear(account, chainId, storage);
      return null;
    }

    // Stored under the wrong identity — never surface it.
    if (!matchesWallet(parsed, account, chainId)) {
      clear(account, chainId, storage);
      return null;
    }

    if (kinds && !kinds.includes(parsed.action.kind)) {
      return null;
    }

    return parsed;
  }

  return {
    storageKey,
    buildPendingTransaction,
    matchesWallet,
    save,
    clear,
    load,
    parse,
  };
}
