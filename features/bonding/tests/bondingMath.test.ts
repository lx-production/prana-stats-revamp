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
  getBondClaimableRaw,
  getBondProgressPercent,
  getConfiguredTerm,
  getDefaultTermId,
  parseBondAmount,
  parsePranaAmount,
  parseWbtcAmount,
  rawBalanceToAmountInput,
} from '../bondingMath.ts';

import type { BondingTermOption } from '../bonding.types.ts';

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

test('getBondClaimableRaw uses cumulative vesting minus claimedRaw', () => {
  const total = 1000n;
  const creation = 0;
  const maturity = 100;

  assert.equal(getBondClaimableRaw(total, 0n, creation, maturity, 30), 300n);
  // After claiming 300, day 50 claimable is the delta only.
  assert.equal(getBondClaimableRaw(total, 300n, creation, maturity, 50), 200n);
  assert.equal(getBondClaimableRaw(total, 300n, creation, maturity, 100), 700n);
  assert.equal(getBondClaimableRaw(total, 1000n, creation, maturity, 100), 0n);
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
