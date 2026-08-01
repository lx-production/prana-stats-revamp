/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PENDING_STAKE_TX_TTL_MS,
  buildPendingStakeTransaction,
  clearPendingStakeTransaction,
  loadPendingStakeTransaction,
  parsePendingStakeTransaction,
  pendingStakeTransactionMatchesWallet,
  savePendingStakeTransaction,
} from '../stakePendingTransactionStorage.ts';

import type { Address, Hex } from '../../../types/blockchain.types.ts';
import type { StakePendingStorage } from '../stakePendingTransactionStorage.ts';

const ACCOUNT = '0x1111111111111111111111111111111111111111' as Address;
const HASH =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex;
const R =
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Hex;
const S =
  '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' as Hex;

function memoryStorage(): StakePendingStorage & { map: Map<string, string> } {
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

test('round-trips a stake pending record through storage', () => {
  const storage = memoryStorage();
  const pending = buildPendingStakeTransaction({
    account: ACCOUNT,
    chainId: 137,
    hash: HASH,
    action: {
      kind: 'stake',
      amountRaw: '1000',
      durationSeconds: 2_592_000,
      deadline: 1_700_000_000,
      v: 28,
      r: R,
      s: S,
    },
    nowMs: 1_700_000_000_000,
  });

  savePendingStakeTransaction(pending, storage);
  const loaded = loadPendingStakeTransaction(
    ACCOUNT,
    137,
    ['stake'],
    storage,
    1_700_000_000_000,
  );

  assert.deepEqual(loaded, pending);
});

test('kind filter hides claim records from the form owner', () => {
  const storage = memoryStorage();
  const pending = buildPendingStakeTransaction({
    account: ACCOUNT,
    chainId: 137,
    hash: HASH,
    action: { kind: 'claim', stakeId: 3 },
  });
  savePendingStakeTransaction(pending, storage);

  assert.equal(
    loadPendingStakeTransaction(ACCOUNT, 137, ['stake'], storage),
    null,
  );
  assert.deepEqual(
    loadPendingStakeTransaction(
      ACCOUNT,
      137,
      ['claim', 'unstake', 'unstakeEarly'],
      storage,
    ),
    pending,
  );
});

test('expired and malformed payloads are cleared', () => {
  const storage = memoryStorage();
  const pending = buildPendingStakeTransaction({
    account: ACCOUNT,
    chainId: 137,
    hash: HASH,
    action: { kind: 'unstake', stakeId: 1 },
    nowMs: 1_000,
  });
  savePendingStakeTransaction(pending, storage);

  assert.equal(
    loadPendingStakeTransaction(
      ACCOUNT,
      137,
      ['unstake'],
      storage,
      1_000 + PENDING_STAKE_TX_TTL_MS + 1,
    ),
    null,
  );
  assert.equal(storage.map.size, 0);

  storage.setItem(
    `prana:staking:pending:v1:137:${ACCOUNT.toLowerCase()}`,
    '{not-json',
  );
  assert.equal(
    loadPendingStakeTransaction(ACCOUNT, 137, undefined, storage),
    null,
  );
  assert.equal(storage.map.size, 0);
});

test('parsePendingStakeTransaction rejects corrupt stake signatures', () => {
  assert.equal(
    parsePendingStakeTransaction(
      JSON.stringify({
        version: 1,
        chainId: 137,
        account: ACCOUNT,
        hash: HASH,
        createdAt: Date.now(),
        action: {
          kind: 'stake',
          amountRaw: '1',
          durationSeconds: 1,
          deadline: 1,
          v: 28,
          r: '0x1234',
          s: S,
        },
      }),
    ),
    null,
  );
});

test('wallet identity match is case-insensitive on account', () => {
  const pending = buildPendingStakeTransaction({
    account: ACCOUNT,
    chainId: 137,
    hash: HASH,
    action: { kind: 'claim', stakeId: 1 },
  });
  assert.equal(
    pendingStakeTransactionMatchesWallet(
      pending,
      ACCOUNT.toUpperCase() as Address,
      137,
    ),
    true,
  );
  assert.equal(
    pendingStakeTransactionMatchesWallet(pending, ACCOUNT, 1),
    false,
  );
});

test('clearPendingStakeTransaction removes the stored record', () => {
  const storage = memoryStorage();
  const pending = buildPendingStakeTransaction({
    account: ACCOUNT,
    chainId: 137,
    hash: HASH,
    action: { kind: 'unstakeEarly', stakeId: 9 },
  });
  savePendingStakeTransaction(pending, storage);
  clearPendingStakeTransaction(ACCOUNT, 137, storage);
  assert.equal(storage.map.size, 0);
});
