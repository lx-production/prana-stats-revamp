/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isBondingQuoteEchoValid,
  resolveCreateAmountRaw,
} from '../utils/bondQuoteEcho.ts';

import type { BondingQuote } from '../bonding.types.ts';
import type { BondingQuoteEchoCheck } from '../utils/bondQuoteEcho.types.ts';

function sampleQuote(overrides: Partial<BondingQuote> = {}): BondingQuote {
  return {
    mode: 'buy_exact_wbtc',
    termId: 1,
    wbtcAmountRaw: '1000',
    pranaAmountRaw: '2000000000',
    rateBpsRaw: '10000',
    durationSeconds: 2_592_000,
    blockNumber: 1,
    blockTimestamp: 1,
    reserveSource: 'impacted',
    issues: [],
    ...overrides,
  };
}

function buyCheck(
  overrides: Partial<BondingQuoteEchoCheck> & {
    quote?: Partial<BondingQuote>;
  } = {},
): BondingQuoteEchoCheck {
  const { quote: quoteOverrides, ...rest } = overrides;
  return {
    quote: sampleQuote(quoteOverrides ?? {}),
    mode: 'buy_exact_wbtc',
    termId: 1,
    formInputRaw: 1000n,
    ...rest,
  };
}

test('buy echo: mode, termId, and wbtcAmountRaw must match form input', () => {
  assert.equal(isBondingQuoteEchoValid(buyCheck()), true);

  assert.equal(
    isBondingQuoteEchoValid(
      buyCheck({ quote: { mode: 'sell_exact_prana' } }),
    ),
    false,
  );
  assert.equal(isBondingQuoteEchoValid(buyCheck({ termId: 2 })), false);
  assert.equal(
    isBondingQuoteEchoValid(buyCheck({ quote: { wbtcAmountRaw: '999' } })),
    false,
  );
  assert.equal(
    isBondingQuoteEchoValid(buyCheck({ formInputRaw: 999n })),
    false,
  );
});

test('sell echo: mode, termId, and pranaAmountRaw must match form input', () => {
  const sell = buyCheck({
    mode: 'sell_exact_prana',
    termId: 0,
    formInputRaw: 5_000_000_000n,
    quote: {
      mode: 'sell_exact_prana',
      termId: 0,
      wbtcAmountRaw: '12',
      pranaAmountRaw: '5000000000',
    },
  });
  assert.equal(isBondingQuoteEchoValid(sell), true);

  assert.equal(
    isBondingQuoteEchoValid({
      ...sell,
      quote: { ...sell.quote, pranaAmountRaw: '1' },
    }),
    false,
  );
  // Output leg may change — only the input leg is asserted.
  assert.equal(
    isBondingQuoteEchoValid({
      ...sell,
      quote: { ...sell.quote, wbtcAmountRaw: '99' },
    }),
    true,
  );
});

test('create calldata amount always comes from the form snapshot', () => {
  assert.equal(resolveCreateAmountRaw(1000n), 1000n);
  assert.equal(resolveCreateAmountRaw(5_000_000_000n), 5_000_000_000n);
});
