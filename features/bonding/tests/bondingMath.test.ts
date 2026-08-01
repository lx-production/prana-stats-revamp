/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseUnits } from 'viem';
import {
  PRANA_DECIMALS,
  WBTC_DECIMALS,
} from '../../../constants/sharedContracts.ts';
import { SECONDS_PER_DAY } from '../../../constants/network.ts';
import { computeBondingQuote } from '../../../server/utils/bondingQuoteMath.ts';
import {
  getBondActionState,
  getBondClaimableRaw,
  getBondProgressPercent,
  getConfiguredTerm,
  getDefaultTermId,
  parseBondAmount,
  parsePranaAmount,
  parseWbtcAmount,
  rawBalanceToAmountInput,
} from '../utils/bondingMath.ts';
import {
  calculateAccruedInterestRaw,
  getEffectiveAccruedSeconds,
} from '../../staking/utils/stakingMath.ts';

import type { ActiveBondRecord, BondingTermOption } from '../bonding.types.ts';

test('parseBondAmount rejects empty, zero, negative, scientific, and junk', () => {
  assert.deepEqual(parseWbtcAmount(''), { ok: false, reason: 'empty' });
  assert.deepEqual(parseWbtcAmount('   '), { ok: false, reason: 'empty' });
  assert.deepEqual(parseWbtcAmount('0'), { ok: false, reason: 'zero' });
  assert.deepEqual(parseWbtcAmount('0.0'), { ok: false, reason: 'zero' });
  assert.deepEqual(parseWbtcAmount('-1'), { ok: false, reason: 'negative' });
  assert.deepEqual(parseWbtcAmount('abc'), { ok: false, reason: 'invalid' });
  assert.deepEqual(parseWbtcAmount('1e8'), { ok: false, reason: 'invalid' });
  assert.deepEqual(parseWbtcAmount('1..2'), { ok: false, reason: 'invalid' });
  assert.deepEqual(parseWbtcAmount('1.2.3'), { ok: false, reason: 'invalid' });
});

test('parseBondAmount enforces WBTC 8 and PRANA 9 decimals', () => {
  assert.deepEqual(parseWbtcAmount('1.123456789'), {
    ok: false,
    reason: 'too_many_decimals',
  });
  assert.deepEqual(parseWbtcAmount('1.12345678'), {
    ok: true,
    raw: parseUnits('1.12345678', WBTC_DECIMALS),
  });

  assert.deepEqual(parsePranaAmount('1.1234567890'), {
    ok: false,
    reason: 'too_many_decimals',
  });
  assert.deepEqual(parsePranaAmount('1.123456789'), {
    ok: true,
    raw: parseUnits('1.123456789', PRANA_DECIMALS),
  });
});

test('parseBondAmount uses parseUnits — never Number/parseFloat', () => {
  const wbtc = parseBondAmount('0.00000001', WBTC_DECIMALS);
  assert.equal(wbtc.ok, true);
  if (wbtc.ok) assert.equal(wbtc.raw, 1n);

  // Larger than Number.MAX_SAFE_INTEGER in raw units still parses exactly.
  const huge = parsePranaAmount('9007199254740993');
  assert.equal(huge.ok, true);
  if (huge.ok) {
    assert.equal(huge.raw, parseUnits('9007199254740993', PRANA_DECIMALS));
  }
});

test('rawBalanceToAmountInput keeps exact decimal string from raw balance', () => {
  const raw = parseUnits('1.23456789', WBTC_DECIMALS);
  assert.equal(rawBalanceToAmountInput(raw, WBTC_DECIMALS), '1.23456789');
  assert.equal(
    rawBalanceToAmountInput(raw.toString(), WBTC_DECIMALS),
    '1.23456789',
  );

  // MAX path must round-trip without float drift.
  const parsed = parseWbtcAmount(rawBalanceToAmountInput(raw, WBTC_DECIMALS));
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.raw, raw);
});

test('getDefaultTermId prefers 30 days then falls back to first', () => {
  const withThirty: BondingTermOption[] = [
    { termId: 0, rateBpsRaw: '100', durationSeconds: 7 * SECONDS_PER_DAY },
    { termId: 1, rateBpsRaw: '200', durationSeconds: 30 * SECONDS_PER_DAY },
    { termId: 2, rateBpsRaw: '300', durationSeconds: 90 * SECONDS_PER_DAY },
  ];
  assert.equal(getDefaultTermId(withThirty), 1);

  const withoutThirty: BondingTermOption[] = [
    { termId: 0, rateBpsRaw: '100', durationSeconds: 7 * SECONDS_PER_DAY },
    { termId: 2, rateBpsRaw: '300', durationSeconds: 90 * SECONDS_PER_DAY },
  ];
  assert.equal(getDefaultTermId(withoutThirty), 0);
  assert.equal(getDefaultTermId([]), null);
});

test('getConfiguredTerm rejects a term removed by refreshed config', () => {
  const terms: BondingTermOption[] = [
    { termId: 0, rateBpsRaw: '100', durationSeconds: 7 * SECONDS_PER_DAY },
    { termId: 1, rateBpsRaw: '200', durationSeconds: 30 * SECONDS_PER_DAY },
  ];

  assert.deepEqual(getConfiguredTerm(terms, 1), terms[1]);
  assert.equal(getConfiguredTerm(terms, 4), null);
  assert.equal(getConfiguredTerm(terms, null), null);

  // Fallback path used by the form when selection vanishes.
  const remaining = terms.filter((term) => term.termId !== 1);
  assert.equal(getConfiguredTerm(remaining, 1), null);
  assert.equal(getDefaultTermId(remaining), 0);
});

test('getBondProgressPercent clamps 0..100 with integer floor math', () => {
  const creation = 1_000;
  const maturity = 1_100;
  assert.equal(getBondProgressPercent(creation, maturity, 900), 0);
  assert.equal(getBondProgressPercent(creation, maturity, 1_000), 0);
  assert.equal(getBondProgressPercent(creation, maturity, 1_050), 50);
  assert.equal(getBondProgressPercent(creation, maturity, 1_099), 99);
  assert.equal(getBondProgressPercent(creation, maturity, 1_100), 100);
  assert.equal(getBondProgressPercent(creation, maturity, 2_000), 100);
});

test('getBondClaimableRaw boundaries match Solidity floor vesting', () => {
  const total = 1000n;
  const creation = 100;
  const maturity = 200;

  // Before / at creation → 0.
  assert.equal(getBondClaimableRaw(total, 0n, creation, maturity, 50), 0n);
  assert.equal(getBondClaimableRaw(total, 0n, creation, maturity, 100), 0n);

  // Mid-vest: floor(1000 × 30 / 100) = 300.
  assert.equal(getBondClaimableRaw(total, 0n, creation, maturity, 130), 300n);

  // Partial claim then later day — delta only (day 50 example: 500 − 300).
  assert.equal(getBondClaimableRaw(total, 300n, creation, maturity, 150), 200n);

  // Exact maturity and after — remaining payout.
  assert.equal(getBondClaimableRaw(total, 300n, creation, maturity, 200), 700n);
  assert.equal(getBondClaimableRaw(total, 300n, creation, maturity, 999), 700n);
  assert.equal(getBondClaimableRaw(total, 1000n, creation, maturity, 200), 0n);
});

test('getBondClaimableRaw multi-claim delta is cumulative vested minus claimed', () => {
  const total = 1000n;
  const creation = 0;
  const maturity = 100;

  assert.equal(getBondClaimableRaw(total, 0n, creation, maturity, 30), 300n);
  // After claiming 300, day 50 claimable is the delta only.
  assert.equal(getBondClaimableRaw(total, 300n, creation, maturity, 50), 200n);
  assert.equal(getBondClaimableRaw(total, 300n, creation, maturity, 100), 700n);
  assert.equal(getBondClaimableRaw(total, 1000n, creation, maturity, 100), 0n);
});

test('Bonding claimable ignores lastClaimTime; Staking accrued uses it', () => {
  const bond: ActiveBondRecord = {
    id: '1',
    side: 'buy',
    version: 'v2',
    owner: '0x1111111111111111111111111111111111111111',
    wbtcAmountRaw: '1',
    pranaAmountRaw: '1000',
    maturityTime: 100,
    creationTime: 0,
    lastClaimTime: 30,
    claimedRaw: '300',
    claimed: false,
  };

  // Same claimedRaw + different lastClaimTime must not change Bonding claimable.
  const at50 = getBondClaimableRaw(1000n, 300n, 0, 100, 50);
  assert.equal(at50, 200n);
  assert.equal(
    getBondActionState({ ...bond, lastClaimTime: 30 }, 50).claimableRaw,
    200n,
  );
  assert.equal(
    getBondActionState({ ...bond, lastClaimTime: 49 }, 50).claimableRaw,
    200n,
  );

  // Progress also independent of lastClaimTime.
  assert.equal(getBondProgressPercent(0, 100, 50), 50);
  assert.equal(
    getBondActionState({ ...bond, lastClaimTime: 10 }, 50).progressPercent,
    50,
  );
  assert.equal(
    getBondActionState({ ...bond, lastClaimTime: 49 }, 50).progressPercent,
    50,
  );

  // Staking: changing lastClaimTime with same principal must change accrued.
  const stakeBase = {
    id: 1,
    amountRaw: '100000000000', // 100 PRANA (9 decimals)
    startTime: 0,
    durationSeconds: 31_536_000,
    apr: 10,
    lastClaimTime: 0,
  };
  const early = calculateAccruedInterestRaw(
    BigInt(stakeBase.amountRaw),
    stakeBase.apr,
    getEffectiveAccruedSeconds(stakeBase, 1_000_000),
  );
  const laterClaim = calculateAccruedInterestRaw(
    BigInt(stakeBase.amountRaw),
    stakeBase.apr,
    getEffectiveAccruedSeconds(
      { ...stakeBase, lastClaimTime: 500_000 },
      1_000_000,
    ),
  );
  assert.notEqual(early, laterClaim);
  assert.ok(early > laterClaim);
});

test('getBondActionState canClaim requires claimable and past lastClaimTime', () => {
  const bond: ActiveBondRecord = {
    id: '7',
    side: 'sell',
    version: 'v1',
    owner: '0x1111111111111111111111111111111111111111',
    wbtcAmountRaw: '1000',
    pranaAmountRaw: '1',
    maturityTime: 100,
    creationTime: 0,
    lastClaimTime: 50,
    claimedRaw: '0',
    claimed: false,
  };

  // Same second as lastClaim — contract would revert "No new amount to claim".
  assert.equal(getBondActionState(bond, 50).canClaim, false);
  assert.equal(getBondActionState(bond, 51).canClaim, true);
  assert.equal(getBondActionState({ ...bond, claimed: true }, 80).canClaim, false);
  assert.equal(
    getBondActionState({ ...bond, claimedRaw: '1000' }, 80).canClaim,
    false,
  );
});

test('quote math is deterministic for same reserves/rates/treasury regardless of clock', () => {
  const base = {
    mode: 'buy_exact_wbtc' as const,
    amountRaw: parseUnits('0.01', WBTC_DECIMALS),
    termId: 1 as const,
    rateBps: 500n,
    durationSeconds: 30 * SECONDS_PER_DAY,
    paused: false,
    minPranaRaw: 1n,
    impactedWbtc: parseUnits('10', WBTC_DECIMALS),
    impactedPrana: parseUnits('1000000', PRANA_DECIMALS),
    poolWbtc: parseUnits('10', WBTC_DECIMALS),
    poolPrana: parseUnits('1000000', PRANA_DECIMALS),
    availableTreasuryRaw: parseUnits('500000', PRANA_DECIMALS),
  };

  // Timestamp is not an input — same state ⇒ same raw quote.
  const a = computeBondingQuote(base);
  const b = computeBondingQuote(base);
  assert.equal(a.wbtcAmountRaw, b.wbtcAmountRaw);
  assert.equal(a.pranaAmountRaw, b.pranaAmountRaw);
  assert.equal(a.reserveSource, b.reserveSource);

  // Changing reserves must change the quote.
  const changed = computeBondingQuote({
    ...base,
    impactedPrana: parseUnits('900000', PRANA_DECIMALS),
  });
  assert.notEqual(changed.pranaAmountRaw, a.pranaAmountRaw);
});
