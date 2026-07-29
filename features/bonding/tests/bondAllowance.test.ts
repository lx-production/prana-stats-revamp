/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isAllowanceSufficientForCreate,
  needsExactInputApproval,
  resolveApproveAmountRaw,
} from '../utils/bondAllowance.ts';

test('exact WBTC / sell: allowance equal to input is enough; one unit short needs approve', () => {
  assert.equal(needsExactInputApproval(100n, 100n), false);
  assert.equal(needsExactInputApproval(99n, 100n), true);
  assert.equal(needsExactInputApproval(1_000n, 100n), false);

  assert.equal(isAllowanceSufficientForCreate(100n, 100n), true);
  assert.equal(isAllowanceSufficientForCreate(99n, 100n), false);
});

test('exact modes never force-lower a larger allowance', () => {
  assert.equal(resolveApproveAmountRaw(50n), 50n);
  assert.equal(needsExactInputApproval(500n, 50n), false);
  assert.equal(isAllowanceSufficientForCreate(500n, 50n), true);
});
