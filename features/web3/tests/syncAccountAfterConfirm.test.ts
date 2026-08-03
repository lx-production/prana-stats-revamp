/// <reference types="node" />
/**
 * Characterization tests for post-receipt account sync (non-blocking UI path).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { syncAccountAfterConfirm } from '../syncAccountAfterConfirm.ts';

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

test('syncFailed false when refetch succeeds', async () => {
  const result = await syncAccountAfterConfirm({
    refetchAccount: async () => successRefetch(),
    isSuccessfulRefetch,
  });
  assert.deepEqual(result, { syncFailed: false });
});

test('syncFailed true when refetch returns invalid result', async () => {
  const result = await syncAccountAfterConfirm({
    refetchAccount: async () => errorRefetch(),
    isSuccessfulRefetch,
  });
  assert.deepEqual(result, { syncFailed: true });
});

test('syncFailed true when refetch throws', async () => {
  const result = await syncAccountAfterConfirm({
    refetchAccount: async () => {
      throw new Error('refetch blew up');
    },
    isSuccessfulRefetch,
  });
  assert.deepEqual(result, { syncFailed: true });
});
