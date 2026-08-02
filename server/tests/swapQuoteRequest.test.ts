import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseSwapQuoteRequest } from '../utils/swapQuoteRequest.ts';
import { sanitizeSwapErrorMessage } from '../helpers/apiRoutesHelpers.ts';

const SAMPLE_RECIPIENT = '0x0000000000000000000000000000000000000001';

test('parseSwapQuoteRequest accepts a valid allowlisted quote body and clamps slippage', () => {
  const parsed = parseSwapQuoteRequest({
    tokenInSymbol: 'USDC',
    tokenOutSymbol: 'PRANA',
    amountIn: '1.5',
    recipient: SAMPLE_RECIPIENT,
    slippageBps: 9999,
  });

  assert.deepEqual(parsed, {
    tokenInSymbol: 'USDC',
    tokenOutSymbol: 'PRANA',
    amountIn: '1.5',
    recipient: SAMPLE_RECIPIENT,
    slippageBps: 500,
  });
});

test('parseSwapQuoteRequest falls back to 50 bps when slippage is missing or non-finite', () => {
  const missing = parseSwapQuoteRequest({
    tokenInSymbol: 'POL',
    tokenOutSymbol: 'USDT',
    amountIn: '1',
    recipient: SAMPLE_RECIPIENT,
  });
  assert.equal(missing.slippageBps, 50);

  const bad = parseSwapQuoteRequest({
    tokenInSymbol: 'POL',
    tokenOutSymbol: 'USDT',
    amountIn: '1',
    recipient: SAMPLE_RECIPIENT,
    slippageBps: Number.NaN,
  });
  assert.equal(bad.slippageBps, 50);
});

test('parseSwapQuoteRequest rejects unsupported tokens, same token, bad address, and bad amounts', () => {
  assert.throws(
    () =>
      parseSwapQuoteRequest({
        tokenInSymbol: 'FAKE',
        tokenOutSymbol: 'PRANA',
        amountIn: '1',
        recipient: SAMPLE_RECIPIENT,
        slippageBps: 50,
      }),
    /Unsupported swap token/,
  );

  assert.throws(
    () =>
      parseSwapQuoteRequest({
        tokenInSymbol: 'PRANA',
        tokenOutSymbol: 'PRANA',
        amountIn: '1',
        recipient: SAMPLE_RECIPIENT,
        slippageBps: 50,
      }),
    /Choose two different tokens/,
  );

  assert.throws(
    () =>
      parseSwapQuoteRequest({
        tokenInSymbol: 'USDC',
        tokenOutSymbol: 'PRANA',
        amountIn: '1',
        recipient: 'not-an-address',
        slippageBps: 50,
      }),
    /Connect a valid wallet address/,
  );

  assert.throws(
    () =>
      parseSwapQuoteRequest({
        tokenInSymbol: 'USDC',
        tokenOutSymbol: 'PRANA',
        amountIn: '0',
        recipient: SAMPLE_RECIPIENT,
        slippageBps: 50,
      }),
    /Enter an amount greater than zero/,
  );

  assert.throws(
    () =>
      parseSwapQuoteRequest({
        tokenInSymbol: 'USDC',
        tokenOutSymbol: 'PRANA',
        amountIn: 'abc',
        recipient: SAMPLE_RECIPIENT,
        slippageBps: 50,
      }),
    /Enter an amount greater than zero/,
  );
});

test('sanitizeSwapErrorMessage passes through swap quote parse messages', () => {
  assert.equal(
    sanitizeSwapErrorMessage(new Error('Unsupported swap token.'), 'fallback'),
    'Unsupported swap token.',
  );
  assert.equal(
    sanitizeSwapErrorMessage(new Error('Invalid swap quote request.'), 'fallback'),
    'Invalid swap quote request.',
  );
});
