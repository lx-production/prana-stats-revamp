/// <reference types="node" />
/**
 * Fully-funded quote math: available fund, Solidity interest, soft issues.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SECONDS_PER_DAY } from '../../../constants/network.ts';
import { calculateTotalInterestRaw } from '../utils/stakingMath.ts';
import {
  availableInterestFundRaw,
  computeStakingQuote,
  isNewStakeFullyFunded,
} from '../utils/stakingFundCheck.ts';

test('availableInterestFundRaw floors at zero when under-reserved', () => {
  assert.equal(availableInterestFundRaw(100n, 40n), 60n);
  assert.equal(availableInterestFundRaw(40n, 40n), 0n);
  assert.equal(availableInterestFundRaw(10n, 40n), 0n);
});

test('isNewStakeFullyFunded requires interest ≤ available fund', () => {
  assert.equal(isNewStakeFullyFunded(100n, 100n), true);
  assert.equal(isNewStakeFullyFunded(100n, 101n), false);
  assert.equal(isNewStakeFullyFunded(0n, 0n), true);
});

test('computeStakingQuote flags insufficient_interest_fund with Solidity interest', () => {
  const amountRaw = 1_000_000_000_000n; // 1000 PRANA (9 decimals)
  const durationSeconds = SECONDS_PER_DAY * 30;
  const apr = 9;
  const newInterest = calculateTotalInterestRaw(amountRaw, apr, durationSeconds);

  // Exactly enough → no fund issue.
  const funded = computeStakingQuote({
    amountRaw,
    durationSeconds,
    apr,
    paused: false,
    minStakeRaw: 100_000_000_000n,
    interestBalanceRaw: newInterest + 50n,
    totalInterestNeededRaw: 50n,
  });
  assert.equal(funded.newStakeInterestRaw, newInterest);
  assert.equal(funded.availableInterestFundRaw, newInterest);
  assert.deepEqual(funded.issues, []);

  // One unit short → insufficient_interest_fund.
  const short = computeStakingQuote({
    amountRaw,
    durationSeconds,
    apr,
    paused: false,
    minStakeRaw: 100_000_000_000n,
    interestBalanceRaw: newInterest + 49n,
    totalInterestNeededRaw: 50n,
  });
  assert.deepEqual(short.issues, ['insufficient_interest_fund']);
  assert.equal(short.availableInterestFundRaw, newInterest - 1n);
});

test('computeStakingQuote soft issues: paused, below_minimum, invalid_duration, zero', () => {
  assert.deepEqual(
    computeStakingQuote({
      amountRaw: 0n,
      durationSeconds: SECONDS_PER_DAY,
      apr: 7,
      paused: true,
      minStakeRaw: 1n,
      interestBalanceRaw: 0n,
      totalInterestNeededRaw: 0n,
    }).issues,
    ['paused', 'zero_amount'],
  );

  assert.deepEqual(
    computeStakingQuote({
      amountRaw: 10n,
      durationSeconds: SECONDS_PER_DAY,
      apr: null,
      paused: false,
      minStakeRaw: 1n,
      interestBalanceRaw: 1_000_000n,
      totalInterestNeededRaw: 0n,
    }).issues,
    ['invalid_duration'],
  );

  const below = computeStakingQuote({
    amountRaw: 5n,
    durationSeconds: SECONDS_PER_DAY,
    apr: 7,
    paused: false,
    minStakeRaw: 10n,
    interestBalanceRaw: 1_000_000_000_000n,
    totalInterestNeededRaw: 0n,
  });
  assert.ok(below.issues.includes('below_minimum'));
  assert.equal(below.issues.includes('insufficient_interest_fund'), false);
});
