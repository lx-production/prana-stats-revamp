/// <reference types="node" />
/**
 * Characterization tests for swap amount formatting.
 * Lock current output before extracting helpers into shared/feature modules.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { V1_SWAP_TOKENS } from '../../constants/swapContracts.ts';
import {
  formatSwapTokenAmount,
  isPositiveDecimalInput,
  parseSwapTokenAmount,
} from '../swapTokenFormatting.ts';

import type { SwapToken } from '../../types/swap.types.ts';

function token(symbol: SwapToken['symbol']): SwapToken {
  const found = V1_SWAP_TOKENS.find((entry) => entry.symbol === symbol);
  assert.ok(found, `missing swap token ${symbol}`);
  return found;
}

test('parseSwapTokenAmount returns 0n for empty, non-positive, or invalid numeric input', () => {
  const usdc = token('USDC');

  assert.equal(parseSwapTokenAmount('', usdc), 0n);
  assert.equal(parseSwapTokenAmount('   ', usdc), 0n);
  assert.equal(parseSwapTokenAmount('0', usdc), 0n);
  assert.equal(parseSwapTokenAmount('0.0', usdc), 0n);
  assert.equal(parseSwapTokenAmount('-1', usdc), 0n);
});

test('parseSwapTokenAmount uses token decimals via viem parseUnits', () => {
  assert.equal(parseSwapTokenAmount('1.5', token('USDC')), 1_500_000n);
  assert.equal(parseSwapTokenAmount('1.5', token('PRANA')), 1_500_000_000n);
  assert.equal(parseSwapTokenAmount('1', token('WBTC')), 100_000_000n);
  assert.equal(parseSwapTokenAmount('1', token('POL')), 1_000_000_000_000_000_000n);
});

test('formatSwapTokenAmount special cases: zero and dust threshold', () => {
  const usdc = token('USDC');

  assert.equal(formatSwapTokenAmount(0n, usdc), '0');
  assert.equal(formatSwapTokenAmount('0', usdc), '0');
  // 1 raw USDC unit = 0.000001 — still above the "<0.000001" threshold
  assert.equal(formatSwapTokenAmount(1n, usdc), '0.000001');
  // Smaller than 1e-6 after formatting (WBTC 1 satoshi of 1e-8) → dust label
  assert.equal(formatSwapTokenAmount(1n, token('WBTC')), '<0.000001');
});

test('formatSwapTokenAmount uses locale maximumFractionDigits default of 6', () => {
  const usdc = token('USDC');
  const prana = token('PRANA');

  assert.equal(formatSwapTokenAmount(1_000_000n, usdc), '1');
  assert.equal(formatSwapTokenAmount(1_500_000n, usdc), '1.5');
  assert.equal(formatSwapTokenAmount(1_500_000_000n, prana), '1.5');
  // Explicit fractionDigits override still applies maximumFractionDigits
  assert.equal(formatSwapTokenAmount(1_234_567n, usdc, 2), '1.23');
});

test('formatSwapTokenAmount accepts string raw amounts', () => {
  assert.equal(formatSwapTokenAmount('1000000', token('USDC')), '1');
  assert.equal(formatSwapTokenAmount('', token('USDC')), '0');
});

test('isPositiveDecimalInput allows digits with optional decimal point only', () => {
  assert.equal(isPositiveDecimalInput(''), true);
  assert.equal(isPositiveDecimalInput('12'), true);
  assert.equal(isPositiveDecimalInput('12.34'), true);
  assert.equal(isPositiveDecimalInput('.'), true);
  assert.equal(isPositiveDecimalInput('12.'), true);
  assert.equal(isPositiveDecimalInput('.5'), true);

  assert.equal(isPositiveDecimalInput('-1'), false);
  assert.equal(isPositiveDecimalInput('1e2'), false);
  assert.equal(isPositiveDecimalInput('abc'), false);
  assert.equal(isPositiveDecimalInput('1.2.3'), false);
});
