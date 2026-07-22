/// <reference types="node" />
/**
 * Characterization tests for pure bigint amount helpers.
 * Must match parseFloat(ethers.formatUnits(...)) without importing ethers in production code.
 */
import { test } from 'node:test';
import { ethers } from 'ethers';
import assert from 'node:assert/strict';
import { formatTokenFloatFromRaw, formatUnitsToString } from '../tokenAmounts.ts';

test('formatUnitsToString matches ethers.formatUnits for common cases', () => {
  const cases: Array<[bigint, number]> = [
    [0n, 9],
    [1n, 9],
    [1_000_000_000n, 9],
    [1_500_000_000n, 9],
    [123_456_789n, 9],
    [100n, 2],
    [101n, 2],
    [5n, 0],
    [-1_500_000_000n, 9],
  ];

  for (const [raw, decimals] of cases) {
    assert.equal(
      formatUnitsToString(raw, decimals),
      ethers.formatUnits(raw, decimals),
      `raw=${raw} decimals=${decimals}`,
    );
  }
});

test('formatTokenFloatFromRaw matches parseFloat(ethers.formatUnits(raw, decimals))', () => {
  const samples: Array<[bigint, number]> = [
    [0n, 9],
    [1n, 9],
    [1_000_000_000n, 9],
    [1_500_000_000n, 9],
    [123_456_789n, 9],
    [999_999_999_999_999_999n, 9],
  ];

  for (const [raw, decimals] of samples) {
    const expected = parseFloat(ethers.formatUnits(raw, decimals));
    assert.equal(formatTokenFloatFromRaw(raw, decimals), expected);
  }
});
