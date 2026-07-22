/// <reference types="node" />
/**
 * Characterization tests for swap wallet error sanitization.
 * Keeps modal-safe messages stable while Swap hooks move behind lazy Web3.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSwapWalletError } from '../utils/sanitizeSwapWalletError.ts';

test('sanitizeSwapWalletError passes through known swap UI messages', () => {
  const known = [
    'Load a quote before swapping.',
    'Quote expired. Refresh to continue.',
    'Refresh the quote before swapping.',
    'Connect your Polygon wallet before swapping.',
    'Connect your Polygon wallet before approving.',
    'Approval transaction reverted.',
    'Swap transaction reverted.',
  ];

  for (const message of known) {
    assert.equal(sanitizeSwapWalletError(new Error(message)), message);
  }
});

test('sanitizeSwapWalletError passes through Insufficient <TOKEN> balance messages', () => {
  assert.equal(
    sanitizeSwapWalletError(new Error('Insufficient USDT balance.')),
    'Insufficient USDT balance.',
  );
  assert.equal(
    sanitizeSwapWalletError(new Error('Insufficient PRANA balance.')),
    'Insufficient PRANA balance.',
  );
});

test('sanitizeSwapWalletError maps EIP-1193 / user rejection to Transaction canceled', () => {
  assert.equal(
    sanitizeSwapWalletError({ code: 4001, message: 'whatever' }),
    'Transaction canceled.',
  );
  assert.equal(
    sanitizeSwapWalletError({ code: 'ACTION_REJECTED' }),
    'Transaction canceled.',
  );
  assert.equal(
    sanitizeSwapWalletError({ name: 'UserRejectedRequestError', message: 'x' }),
    'Transaction canceled.',
  );
  assert.equal(
    sanitizeSwapWalletError(new Error('User rejected the request')),
    'Transaction canceled.',
  );
  assert.equal(
    sanitizeSwapWalletError(new Error('User denied transaction signature')),
    'Transaction canceled.',
  );
  assert.equal(
    sanitizeSwapWalletError(new Error('MetaMask: request rejected by user')),
    'Transaction canceled.',
  );
});

test('sanitizeSwapWalletError walks nested cause chain for user rejection', () => {
  const nested = {
    message: 'ContractFunctionExecutionError',
    cause: {
      message: 'TransactionExecutionError',
      cause: {
        code: 4001,
        message: 'User rejected the request.',
      },
    },
  };

  assert.equal(sanitizeSwapWalletError(nested), 'Transaction canceled.');
});

test('sanitizeSwapWalletError hides unknown internals behind fallback', () => {
  assert.equal(
    sanitizeSwapWalletError(new Error('execution reverted: 0xdeadbeef...longcalldata')),
    'Transaction failed. Please try again.',
  );
  assert.equal(
    sanitizeSwapWalletError(new Error('Alchemy API key leaked'), 'Swap failed. Please try again.'),
    'Swap failed. Please try again.',
  );
  assert.equal(
    sanitizeSwapWalletError('not-an-error', 'Approval failed. Please try again.'),
    'Approval failed. Please try again.',
  );
});
