/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isAllowanceSufficientForCreate,
  needsExactInputApproval,
  needsTargetPranaApproval,
  resolveApproveAmountRaw,
} from '../utils/bondAllowance.ts';

test('exact WBTC / sell: allowance equal to input is enough; one unit short needs approve', () => {
  assert.equal(needsExactInputApproval(100n, 100n), false);
  assert.equal(needsExactInputApproval(99n, 100n), true);
  assert.equal(needsExactInputApproval(1_000n, 100n), false);

  assert.equal(
    isAllowanceSufficientForCreate({
      mode: 'buy_exact_wbtc',
      currentAllowanceRaw: 100n,
      inputAmountRaw: 100n,
      quoteWbtcAmountRaw: 0n,
    }),
    true,
  );
  assert.equal(
    isAllowanceSufficientForCreate({
      mode: 'sell_exact_prana',
      currentAllowanceRaw: 99n,
      inputAmountRaw: 100n,
      quoteWbtcAmountRaw: 0n,
    }),
    false,
  );
});

test('exact modes never force-lower a larger allowance', () => {
  assert.equal(
    resolveApproveAmountRaw({
      mode: 'buy_exact_wbtc',
      inputAmountRaw: 50n,
      quoteWbtcAmountRaw: 999n,
    }),
    50n,
  );
  assert.equal(needsExactInputApproval(500n, 50n), false);
});

test('target PRANA: surplus allowance without session cap must be capped', () => {
  assert.equal(
    needsTargetPranaApproval({
      currentAllowanceRaw: 1_000n,
      quoteWbtcAmountRaw: 100n,
      sessionApprovedCapRaw: null,
    }),
    true,
  );

  assert.equal(
    resolveApproveAmountRaw({
      mode: 'buy_target_prana',
      inputAmountRaw: 999n,
      quoteWbtcAmountRaw: 100n,
    }),
    100n,
  );
});

test('target PRANA: session cap covering quote allows review without re-approve', () => {
  assert.equal(
    needsTargetPranaApproval({
      currentAllowanceRaw: 100n,
      quoteWbtcAmountRaw: 80n,
      sessionApprovedCapRaw: 100n,
    }),
    false,
  );

  assert.equal(
    isAllowanceSufficientForCreate({
      mode: 'buy_target_prana',
      currentAllowanceRaw: 100n,
      inputAmountRaw: 0n,
      quoteWbtcAmountRaw: 80n,
    }),
    true,
  );
});

test('target PRANA: fresh quote above cap requires approve again', () => {
  assert.equal(
    needsTargetPranaApproval({
      currentAllowanceRaw: 100n,
      quoteWbtcAmountRaw: 101n,
      sessionApprovedCapRaw: 100n,
    }),
    true,
  );

  assert.equal(
    isAllowanceSufficientForCreate({
      mode: 'buy_target_prana',
      currentAllowanceRaw: 100n,
      inputAmountRaw: 0n,
      quoteWbtcAmountRaw: 101n,
    }),
    false,
  );
});

test('target PRANA: exact match allowance is sufficient without session cap', () => {
  assert.equal(
    needsTargetPranaApproval({
      currentAllowanceRaw: 100n,
      quoteWbtcAmountRaw: 100n,
      sessionApprovedCapRaw: null,
    }),
    false,
  );
});
