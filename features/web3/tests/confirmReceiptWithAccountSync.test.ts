/// <reference types="node" />
/**
 * Characterization tests for confirm + account sync orchestration.
 * Staking/Bonding thin adapters delegate here.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confirmReceiptWithAccountSync } from '../confirmReceiptWithAccountSync.ts';

import type { Hex } from '../../../types/blockchain.types.ts';

const HASH =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex;

function successRefetch() {
  return { isSuccess: true, status: 'success', data: { address: '0x1' }, error: null };
}

function errorRefetch() {
  return {
    isSuccess: false,
    status: 'error',
    data: { address: '0x1' },
    error: new Error('network'),
  };
}

/** Mirrors accountFromSuccessfulRefetch without importing feature types. */
function isSuccessfulRefetch(refreshed: unknown): boolean {
  if (!refreshed || typeof refreshed !== 'object') return false;
  const result = refreshed as {
    isSuccess?: boolean;
    status?: string;
    error?: unknown;
    data?: unknown;
  };
  const ok = result.isSuccess === true || result.status === 'success';
  return ok && result.error == null && result.data != null;
}

test('confirmed + sync success from browser receipt without calling server', async () => {
  let serverCalls = 0;
  let refetched = false;

  const outcome = await confirmReceiptWithAccountSync({
    hash: HASH,
    waitForReceipt: async () => ({ status: 'success' }),
    confirmOnServer: async () => {
      serverCalls += 1;
      return { status: 'confirmed', source: 'server' };
    },
    refetchAccount: async () => {
      refetched = true;
      return successRefetch();
    },
    isSuccessfulRefetch,
  });

  assert.deepEqual(outcome, {
    kind: 'confirmed',
    syncFailed: false,
    source: 'browser',
  });
  assert.equal(serverCalls, 0);
  assert.equal(refetched, true);
});

test('confirmed + syncFailed when refetch returns invalid result', async () => {
  const outcome = await confirmReceiptWithAccountSync({
    hash: HASH,
    waitForReceipt: async () => ({ status: 'success' }),
    confirmOnServer: async () => ({ status: 'confirmed', source: 'server' }),
    refetchAccount: async () => errorRefetch(),
    isSuccessfulRefetch,
  });

  assert.deepEqual(outcome, {
    kind: 'confirmed',
    syncFailed: true,
    source: 'browser',
  });
});

test('confirmed + syncFailed when refetch throws', async () => {
  const outcome = await confirmReceiptWithAccountSync({
    hash: HASH,
    waitForReceipt: async () => ({ status: 'success' }),
    confirmOnServer: async () => ({ status: 'confirmed', source: 'server' }),
    refetchAccount: async () => {
      throw new Error('refetch blew up');
    },
    isSuccessfulRefetch,
  });

  assert.deepEqual(outcome, {
    kind: 'confirmed',
    syncFailed: true,
    source: 'browser',
  });
});

test('reverted does not refetch account', async () => {
  let refetched = false;

  const outcome = await confirmReceiptWithAccountSync({
    hash: HASH,
    waitForReceipt: async () => ({ status: 'reverted' }),
    confirmOnServer: async () => ({ status: 'confirmed', source: 'server' }),
    refetchAccount: async () => {
      refetched = true;
      return successRefetch();
    },
    isSuccessfulRefetch,
  });

  assert.equal(outcome.kind, 'reverted');
  assert.equal(refetched, false);
});

test('confirmation_unavailable does not refetch account', async () => {
  let refetched = false;
  const receiptError = new Error('Unknown block');
  const verificationError = new Error('Server RPC unavailable');

  const outcome = await confirmReceiptWithAccountSync({
    hash: HASH,
    waitForReceipt: async () => {
      throw receiptError;
    },
    confirmOnServer: async () => {
      throw verificationError;
    },
    refetchAccount: async () => {
      refetched = true;
      return successRefetch();
    },
    isSuccessfulRefetch,
  });

  assert.deepEqual(outcome, {
    kind: 'confirmation_unavailable',
    receiptError,
    verificationError,
  });
  assert.equal(refetched, false);
});

test('requireServerValidation keeps source server after sync', async () => {
  let serverCalls = 0;

  const outcome = await confirmReceiptWithAccountSync({
    hash: HASH,
    requireServerValidation: true,
    waitForReceipt: async () => ({ status: 'success' }),
    confirmOnServer: async () => {
      serverCalls += 1;
      return { status: 'confirmed', source: 'server' };
    },
    refetchAccount: async () => successRefetch(),
    isSuccessfulRefetch,
  });

  assert.deepEqual(outcome, {
    kind: 'confirmed',
    syncFailed: false,
    source: 'server',
  });
  assert.equal(serverCalls, 1);
});

test('browser RPC failure falls back to server then syncs', async () => {
  const outcome = await confirmReceiptWithAccountSync({
    hash: HASH,
    waitForReceipt: async () => {
      throw new Error('browser RPC read failed');
    },
    confirmOnServer: async () => ({ status: 'confirmed', source: 'server' }),
    refetchAccount: async () => successRefetch(),
    isSuccessfulRefetch,
  });

  assert.deepEqual(outcome, {
    kind: 'confirmed',
    syncFailed: false,
    source: 'server',
  });
});
