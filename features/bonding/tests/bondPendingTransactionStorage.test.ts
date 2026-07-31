/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PENDING_BOND_TX_TTL_MS,
  buildPendingBondTransaction,
  clearPendingBondTransaction,
  loadPendingBondTransaction,
  parsePendingBondTransaction,
  pendingBondTransactionMatchesWallet,
  pendingBondTransactionStorageKey,
  savePendingBondTransaction,
} from '../utils/bondPendingTransactionStorage.ts';

import type { PendingBondTransaction } from '../bonding.types.ts';
import type { Address, Hex } from '../../../types/blockchain.types.ts';
import type { BondPendingStorage } from '../utils/bondPendingTransactionStorage.ts';

const ACCOUNT = '0x1111111111111111111111111111111111111111' as Address;
const OTHER = '0x2222222222222222222222222222222222222222' as Address;
const HASH =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex;

function memoryStorage(): BondPendingStorage {
  const map = new Map<string, string>();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

function samplePending(
  overrides: Partial<PendingBondTransaction> = {},
): PendingBondTransaction {
  return {
    ...buildPendingBondTransaction({
      account: ACCOUNT,
      chainId: 137,
      hash: HASH,
      action: {
        kind: 'create',
        side: 'buy',
        version: 'v2',
        mode: 'buy_exact_wbtc',
        amountRaw: '1000',
        termId: 0,
      },
      nowMs: 1_700_000_000_000,
    }),
    ...overrides,
  };
}

test('save + load round-trips a pending create for the same account/chain', () => {
  const storage = memoryStorage();
  const pending = samplePending();
  savePendingBondTransaction(pending, storage);

  const loaded = loadPendingBondTransaction(
    ACCOUNT,
    137,
    ['approve', 'create'],
    storage,
    pending.createdAt,
  );
  assert.deepEqual(loaded, pending);
});

test('load filters by action kind so claim owners ignore form pendings', () => {
  const storage = memoryStorage();
  savePendingBondTransaction(samplePending(), storage);

  assert.equal(
    loadPendingBondTransaction(ACCOUNT, 137, ['claim'], storage, 1_700_000_000_000),
    null,
  );
  assert.ok(
    loadPendingBondTransaction(
      ACCOUNT,
      137,
      ['approve', 'create'],
      storage,
      1_700_000_000_000,
    ),
  );
});

test('expired and malformed records are cleared', () => {
  const storage = memoryStorage();
  const key = pendingBondTransactionStorageKey(ACCOUNT, 137);

  savePendingBondTransaction(
    samplePending({ createdAt: 1_000_000_000_000 }),
    storage,
  );
  assert.equal(
    loadPendingBondTransaction(
      ACCOUNT,
      137,
      undefined,
      storage,
      1_000_000_000_000 + PENDING_BOND_TX_TTL_MS + 1,
    ),
    null,
  );
  assert.equal(storage.getItem(key), null);

  storage.setItem(key, '{not-json');
  assert.equal(
    loadPendingBondTransaction(ACCOUNT, 137, undefined, storage),
    null,
  );
  assert.equal(storage.getItem(key), null);
});

test('wrong account or chain does not restore a pending record', () => {
  const storage = memoryStorage();
  savePendingBondTransaction(samplePending(), storage);

  assert.equal(
    loadPendingBondTransaction(OTHER, 137, undefined, storage, 1_700_000_000_000),
    null,
  );
  assert.equal(
    loadPendingBondTransaction(ACCOUNT, 1, undefined, storage, 1_700_000_000_000),
    null,
  );
});

test('clear removes the stored record for that identity', () => {
  const storage = memoryStorage();
  savePendingBondTransaction(samplePending(), storage);
  clearPendingBondTransaction(ACCOUNT, 137, storage);
  assert.equal(
    loadPendingBondTransaction(ACCOUNT, 137, undefined, storage, 1_700_000_000_000),
    null,
  );
});

test('parsePendingBondTransaction rejects bad action shapes', () => {
  assert.equal(parsePendingBondTransaction('[]'), null);
  assert.equal(
    parsePendingBondTransaction(
      JSON.stringify({
        version: 1,
        chainId: 137,
        account: ACCOUNT,
        hash: HASH,
        createdAt: Date.now(),
        action: { kind: 'create', side: 'buy', version: 'v1' },
      }),
    ),
    null,
  );
});

test('pendingBondTransactionMatchesWallet binds account and chain', () => {
  const pending = samplePending();
  assert.equal(pendingBondTransactionMatchesWallet(pending, ACCOUNT, 137), true);
  assert.equal(pendingBondTransactionMatchesWallet(pending, OTHER, 137), false);
  assert.equal(pendingBondTransactionMatchesWallet(pending, ACCOUNT, 1), false);
  assert.equal(pendingBondTransactionMatchesWallet(pending, undefined, 137), false);
});
