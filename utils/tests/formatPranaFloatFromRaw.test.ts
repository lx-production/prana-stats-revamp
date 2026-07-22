/// <reference types="node" />
/**
 * Characterization tests for PRANA raw→float formatting.
 * Implementation is pure bigint via tokenAmounts (no ethers in formatters).
 * Keep these outputs stable vs parseFloat(ethers.formatUnits(raw, 9)).
 */
import { test } from 'node:test';
import { ethers } from 'ethers';
import assert from 'node:assert/strict';
import { PRANA_DECIMALS } from '../../constants/sharedContracts.ts';
import { formatPranaFloatFromRaw } from '../formatters.ts';

test('formatPranaFloatFromRaw matches parseFloat(ethers.formatUnits(raw, 9))', () => {
  const samples = [
    0n,
    1n,
    1_000_000_000n, // 1 PRANA
    1_500_000_000n, // 1.5
    123_456_789n, // 0.123456789
    999_999_999_999_999_999n,
  ];

  for (const raw of samples) {
    const expected = parseFloat(ethers.formatUnits(raw, PRANA_DECIMALS));
    assert.equal(formatPranaFloatFromRaw(raw), expected);
  }
});

test('formatPranaFloatFromRaw returns Number for whole and fractional PRANA', () => {
  assert.equal(formatPranaFloatFromRaw(0n), 0);
  assert.equal(formatPranaFloatFromRaw(1_000_000_000n), 1);
  assert.equal(formatPranaFloatFromRaw(1_500_000_000n), 1.5);
  // Dust: parseFloat keeps scientific notation as a number value
  assert.equal(formatPranaFloatFromRaw(1n), 1e-9);
});
