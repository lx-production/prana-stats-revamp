/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmSwapTransaction } from '../utils/swapTransactionConfirmation.ts';

test('confirms from the browser receipt without calling the server', async () => {
  let serverCalls = 0;

  const outcome = await confirmSwapTransaction({
    waitForReceipt: async () => ({ status: 'success' }),
    verifyOnServer: async () => {
      serverCalls += 1;
    },
  });

  assert.deepEqual(outcome, { kind: 'confirmed', source: 'browser' });
  assert.equal(serverCalls, 0);
});

test('reports an actual reverted receipt as a failed transaction', async () => {
  const outcome = await confirmSwapTransaction({
    waitForReceipt: async () => ({ status: 'reverted' }),
    verifyOnServer: async () => {},
  });

  assert.deepEqual(outcome, { kind: 'reverted' });
});

test('uses server verification when the browser RPC cannot read the receipt', async () => {
  const outcome = await confirmSwapTransaction({
    waitForReceipt: async () => {
      throw new Error('Unknown block');
    },
    verifyOnServer: async () => {},
  });

  assert.deepEqual(outcome, { kind: 'confirmed', source: 'server' });
});

test('keeps an unknown final state separate from an on-chain failure', async () => {
  const receiptError = new Error('Unknown block');
  const verificationError = new Error('Server RPC unavailable');

  const outcome = await confirmSwapTransaction({
    waitForReceipt: async () => {
      throw receiptError;
    },
    verifyOnServer: async () => {
      throw verificationError;
    },
  });

  assert.deepEqual(outcome, {
    kind: 'confirmation_unavailable',
    receiptError,
    verificationError,
  });
});
