/// <reference types="node" />
/**
 * Characterization tests for the shared pending-tx envelope factory.
 * Feature action parsers stay covered in staking/bonding test suites.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PENDING_TX_TTL_MS,
  createMemoryPendingStorage,
  createPendingTransactionStorage,
} from '../pendingTransactionStorage.ts';

import type { Address, Hex } from '../../../types/blockchain.types.ts';

type DemoAction = { kind: 'demo' | 'other'; label: string };

const ACCOUNT = '0x1111111111111111111111111111111111111111' as Address;
const OTHER = '0x2222222222222222222222222222222222222222' as Address;
const HASH =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex;
const PREFIX = 'prana:demo:pending:v1';

function parseDemoAction(value: unknown): DemoAction | null {
  if (!value || typeof value !== 'object') return null;
  const action = value as Record<string, unknown>;
  if (action.kind !== 'demo' && action.kind !== 'other') return null;
  if (typeof action.label !== 'string') return null;
  return { kind: action.kind, label: action.label };
}

const demoStorage = createPendingTransactionStorage<DemoAction>({
  storagePrefix: PREFIX,
  ttlMs: PENDING_TX_TTL_MS,
  parseAction: parseDemoAction,
});

test('storageKey keeps prefix + chain + lowercase account', () => {
  assert.equal(
    demoStorage.storageKey(ACCOUNT, 137),
    `${PREFIX}:137:${ACCOUNT.toLowerCase()}`,
  );
  assert.equal(
    demoStorage.storageKey(ACCOUNT.toUpperCase() as Address, 137),
    `${PREFIX}:137:${ACCOUNT.toLowerCase()}`,
  );
});

test('round-trips a pending record through in-memory storage', () => {
  const storage = createMemoryPendingStorage();
  const pending = demoStorage.buildPendingTransaction({
    account: ACCOUNT,
    chainId: 137,
    hash: HASH,
    action: { kind: 'demo', label: 'ok' },
    nowMs: 1_700_000_000_000,
  });

  demoStorage.save(pending, storage);
  const loaded = demoStorage.load(
    ACCOUNT,
    137,
    ['demo'],
    storage,
    1_700_000_000_000,
  );

  assert.deepEqual(loaded, pending);
});

test('kind filter hides records owned by another consumer', () => {
  const storage = createMemoryPendingStorage();
  const pending = demoStorage.buildPendingTransaction({
    account: ACCOUNT,
    chainId: 137,
    hash: HASH,
    action: { kind: 'other', label: 'x' },
    nowMs: 1_700_000_000_000,
  });
  demoStorage.save(pending, storage);

  assert.equal(
    demoStorage.load(ACCOUNT, 137, ['demo'], storage, 1_700_000_000_000),
    null,
  );
  assert.deepEqual(
    demoStorage.load(ACCOUNT, 137, ['other'], storage, 1_700_000_000_000),
    pending,
  );
});

test('expired and malformed payloads are cleared', () => {
  const storage = createMemoryPendingStorage();
  const pending = demoStorage.buildPendingTransaction({
    account: ACCOUNT,
    chainId: 137,
    hash: HASH,
    action: { kind: 'demo', label: 'old' },
    nowMs: 1_000,
  });
  demoStorage.save(pending, storage);

  assert.equal(
    demoStorage.load(
      ACCOUNT,
      137,
      undefined,
      storage,
      1_000 + PENDING_TX_TTL_MS + 1,
    ),
    null,
  );
  assert.equal(storage.map.size, 0);

  storage.setItem(demoStorage.storageKey(ACCOUNT, 137), '{not-json');
  assert.equal(demoStorage.load(ACCOUNT, 137, undefined, storage), null);
  assert.equal(storage.map.size, 0);
});

test('wrong account or chain does not restore a pending record', () => {
  const storage = createMemoryPendingStorage();
  const pending = demoStorage.buildPendingTransaction({
    account: ACCOUNT,
    chainId: 137,
    hash: HASH,
    action: { kind: 'demo', label: 'x' },
    nowMs: 1_700_000_000_000,
  });
  demoStorage.save(pending, storage);

  assert.equal(
    demoStorage.load(OTHER, 137, undefined, storage, 1_700_000_000_000),
    null,
  );
  assert.equal(
    demoStorage.load(ACCOUNT, 1, undefined, storage, 1_700_000_000_000),
    null,
  );
});

test('identity-mismatched payload under the key is cleared', () => {
  const storage = createMemoryPendingStorage();
  const key = demoStorage.storageKey(ACCOUNT, 137);

  storage.setItem(
    key,
    JSON.stringify({
      version: 1,
      chainId: 137,
      account: OTHER,
      hash: HASH,
      createdAt: 1_700_000_000_000,
      action: { kind: 'demo', label: 'x' },
    }),
  );

  assert.equal(
    demoStorage.load(ACCOUNT, 137, undefined, storage, 1_700_000_000_000),
    null,
  );
  assert.equal(storage.getItem(key), null);
});

test('matchesWallet is case-insensitive on account', () => {
  const pending = demoStorage.buildPendingTransaction({
    account: ACCOUNT,
    chainId: 137,
    hash: HASH,
    action: { kind: 'demo', label: 'x' },
  });

  assert.equal(
    demoStorage.matchesWallet(pending, ACCOUNT.toUpperCase() as Address, 137),
    true,
  );
  assert.equal(demoStorage.matchesWallet(pending, ACCOUNT, 1), false);
  assert.equal(demoStorage.matchesWallet(pending, undefined, 137), false);
});

test('clear removes the stored record for that identity', () => {
  const storage = createMemoryPendingStorage();
  const pending = demoStorage.buildPendingTransaction({
    account: ACCOUNT,
    chainId: 137,
    hash: HASH,
    action: { kind: 'demo', label: 'x' },
  });
  demoStorage.save(pending, storage);
  demoStorage.clear(ACCOUNT, 137, storage);
  assert.equal(storage.map.size, 0);
});

test('parse rejects far-future createdAt and unknown action', () => {
  const now = 1_700_000_000_000;
  assert.equal(
    demoStorage.parse(
      JSON.stringify({
        version: 1,
        chainId: 137,
        account: ACCOUNT,
        hash: HASH,
        createdAt: now + 120_000,
        action: { kind: 'demo', label: 'x' },
      }),
      now,
    ),
    null,
  );
  assert.equal(
    demoStorage.parse(
      JSON.stringify({
        version: 1,
        chainId: 137,
        account: ACCOUNT,
        hash: HASH,
        createdAt: now,
        action: { kind: 'nope', label: 'x' },
      }),
      now,
    ),
    null,
  );
});
