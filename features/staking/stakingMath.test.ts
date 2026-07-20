import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseUnits } from 'viem';
import { PRANA_DECIMALS } from '../../constants/sharedContracts.ts';
import { SECONDS_PER_DAY, SECONDS_PER_YEAR } from '../../constants/network.ts';
import {
  calculateTotalInterestRaw,
  getDefaultDurationSeconds,
  getEffectiveAccruedSeconds,
  parseStakeAmount,
} from './stakingMath.ts';

import type { StakeRecord, StakingDurationOption } from './staking.types.ts';

test('parseStakeAmount rejects empty, zero, negative, and invalid input', () => {
  assert.deepEqual(parseStakeAmount(''), { ok: false, reason: 'empty' });
  assert.deepEqual(parseStakeAmount('   '), { ok: false, reason: 'empty' });
  assert.deepEqual(parseStakeAmount('0'), { ok: false, reason: 'zero' });
  assert.deepEqual(parseStakeAmount('0.0'), { ok: false, reason: 'zero' });
  assert.deepEqual(parseStakeAmount('-1'), { ok: false, reason: 'negative' });
  assert.deepEqual(parseStakeAmount('abc'), { ok: false, reason: 'invalid' });
  assert.deepEqual(parseStakeAmount('1e9'), { ok: false, reason: 'invalid' });
});

test('parseStakeAmount rejects more than 9 decimal places', () => {
  assert.deepEqual(parseStakeAmount('1.1234567890'), {
    ok: false,
    reason: 'too_many_decimals',
  });
  assert.deepEqual(parseStakeAmount('1.123456789'), {
    ok: true,
    raw: parseUnits('1.123456789', PRANA_DECIMALS),
  });
});

test('parseStakeAmount uses parseUnits with PRANA_DECIMALS', () => {
  const result = parseStakeAmount('100.5');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.raw, parseUnits('100.5', PRANA_DECIMALS));
  }
});

test('calculateTotalInterestRaw follows Solidity integer division order', () => {
  // 1000 PRANA raw (9 decimals) at 10% APR for 365 days
  const amountRaw = parseUnits('1000', PRANA_DECIMALS);
  const apr = 10;
  const duration = SECONDS_PER_YEAR;

  const annualInterest = (amountRaw * BigInt(apr)) / 100n;
  const interestPerSecond = annualInterest / BigInt(SECONDS_PER_YEAR);
  const expected = interestPerSecond * BigInt(duration);

  assert.equal(calculateTotalInterestRaw(amountRaw, apr, duration), expected);

  // Floating-point path must NOT be used — verify we truncate like Solidity.
  // Example where intermediate float would drift: large principal, short duration.
  const large = parseUnits('1234567.890123456', PRANA_DECIMALS);
  const short = SECONDS_PER_DAY;
  const solid = calculateTotalInterestRaw(large, 7, short);
  const annual = (large * 7n) / 100n;
  const perSecond = annual / BigInt(SECONDS_PER_YEAR);
  assert.equal(solid, perSecond * BigInt(short));
});

test('getDefaultDurationSeconds prefers 30 days then falls back to first', () => {
  const withThirty: StakingDurationOption[] = [
    { seconds: SECONDS_PER_DAY, days: 1, apr: 7 },
    { seconds: 30 * SECONDS_PER_DAY, days: 30, apr: 12 },
    { seconds: 90 * SECONDS_PER_DAY, days: 90, apr: 18 },
  ];
  assert.equal(getDefaultDurationSeconds(withThirty), 30 * SECONDS_PER_DAY);

  const withoutThirty: StakingDurationOption[] = [
    { seconds: 7 * SECONDS_PER_DAY, days: 7, apr: 9 },
    { seconds: 60 * SECONDS_PER_DAY, days: 60, apr: 15 },
  ];
  assert.equal(getDefaultDurationSeconds(withoutThirty), 7 * SECONDS_PER_DAY);

  assert.equal(getDefaultDurationSeconds([]), null);
});

test('getEffectiveAccruedSeconds starts from lastClaimTime, not startTime', () => {
  const startTime = 1_700_000_000;
  const stake: StakeRecord = {
    id: 1,
    amountRaw: '1000000000000',
    startTime,
    durationSeconds: 30 * SECONDS_PER_DAY,
    apr: 12,
    lastClaimTime: startTime + 10 * SECONDS_PER_DAY,
  };

  const now = startTime + 20 * SECONDS_PER_DAY;
  // Unclaimed window is day 10 → day 20, not day 0 → day 20.
  assert.equal(getEffectiveAccruedSeconds(stake, now), 10 * SECONDS_PER_DAY);

  // Before any claim, lastClaimTime equals startTime → full elapsed.
  const neverClaimed: StakeRecord = { ...stake, lastClaimTime: startTime };
  assert.equal(
    getEffectiveAccruedSeconds(neverClaimed, now),
    20 * SECONDS_PER_DAY,
  );

  // Cap at maturity even if lastClaimTime is earlier.
  const afterMaturity = startTime + 40 * SECONDS_PER_DAY;
  assert.equal(
    getEffectiveAccruedSeconds(stake, afterMaturity),
    20 * SECONDS_PER_DAY,
  );
});
