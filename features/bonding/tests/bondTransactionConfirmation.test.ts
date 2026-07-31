/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confirmBondTransaction } from '../utils/bondTransactionConfirmation.ts';

test('confirms from the browser receipt without calling the server', async () => {
  let serverCalls = 0;

  const outcome = await confirmBondTransaction({
    waitForReceipt: async () => ({ status: 'success' }),
    confirmOnServer: async () => {
      serverCalls += 1;
      return { status: 'confirmed', source: 'server' };
    },
  });

  assert.deepEqual(outcome, { kind: 'confirmed', source: 'browser' });
  assert.equal(serverCalls, 0);
});

test('reports an actual reverted receipt as a failed transaction', async () => {
  const outcome = await confirmBondTransaction({
    waitForReceipt: async () => ({ status: 'reverted' }),
    confirmOnServer: async () => ({ status: 'confirmed', source: 'server' }),
  });

  assert.deepEqual(outcome, { kind: 'reverted', source: 'browser' });
});

test('uses server confirmation when the browser RPC cannot read the receipt', async () => {
  const outcome = await confirmBondTransaction({
    waitForReceipt: async () => {
      throw new Error('Unknown block');
    },
    confirmOnServer: async () => ({ status: 'confirmed', source: 'server' }),
  });

  assert.deepEqual(outcome, { kind: 'confirmed', source: 'server' });
});

test('server revert after browser RPC error is terminal reverted', async () => {
  const outcome = await confirmBondTransaction({
    waitForReceipt: async () => {
      throw new Error('Unknown block');
    },
    confirmOnServer: async () => ({ status: 'reverted', source: 'server' }),
  });

  assert.deepEqual(outcome, { kind: 'reverted', source: 'server' });
});

test('keeps confirmation_unavailable when browser and server cannot decide', async () => {
  const receiptError = new Error('Unknown block');
  const verificationError = new Error('Server RPC unavailable');

  const outcome = await confirmBondTransaction({
    waitForReceipt: async () => {
      throw receiptError;
    },
    confirmOnServer: async () => {
      throw verificationError;
    },
  });

  assert.deepEqual(outcome, {
    kind: 'confirmation_unavailable',
    receiptError,
    verificationError,
  });
});

test('server not_mined stays confirmation_unavailable, not failed', async () => {
  const receiptError = new Error('timeout');

  const outcome = await confirmBondTransaction({
    waitForReceipt: async () => {
      throw receiptError;
    },
    confirmOnServer: async () => ({ status: 'not_mined' }),
  });

  assert.equal(outcome.kind, 'confirmation_unavailable');
});

test('requireServerValidation still calls server after browser receipt success', async () => {
  let serverCalls = 0;

  const outcome = await confirmBondTransaction({
    requireServerValidation: true,
    waitForReceipt: async () => ({ status: 'success' }),
    confirmOnServer: async () => {
      serverCalls += 1;
      return { status: 'confirmed', source: 'server' };
    },
  });

  assert.deepEqual(outcome, { kind: 'confirmed', source: 'server' });
  assert.equal(serverCalls, 1);
});

test('requireServerValidation does not confirm when server cannot validate', async () => {
  const outcome = await confirmBondTransaction({
    requireServerValidation: true,
    waitForReceipt: async () => ({ status: 'success' }),
    confirmOnServer: async () => ({ status: 'confirmation_unavailable' }),
  });

  assert.equal(outcome.kind, 'confirmation_unavailable');
});

test('requireServerValidation surfaces server mismatch as unavailable', async () => {
  const verificationError = new Error('confirmation_mismatch');

  const outcome = await confirmBondTransaction({
    requireServerValidation: true,
    waitForReceipt: async () => ({ status: 'success' }),
    confirmOnServer: async () => {
      throw verificationError;
    },
  });

  assert.deepEqual(outcome, {
    kind: 'confirmation_unavailable',
    receiptError: null,
    verificationError,
  });
});
