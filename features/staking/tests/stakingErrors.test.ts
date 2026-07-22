/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyStakingError } from '../stakingErrors.ts';

test('classifyStakingError maps common wallet/provider failures', () => {
  assert.equal(
    classifyStakingError(new Error('User rejected the request')),
    'user_rejected',
  );
  assert.equal(
    classifyStakingError(new Error('User denied transaction signature')),
    'user_rejected',
  );
  assert.equal(
    classifyStakingError(new Error('active chainId is different from ...')),
    'wrong_chain',
  );
  assert.equal(
    classifyStakingError(new Error('insufficient funds for gas')),
    'insufficient_gas',
  );
  assert.equal(
    classifyStakingError(new Error('transfer amount exceeds balance')),
    'insufficient_balance',
  );
  assert.equal(
    classifyStakingError(new Error('execution reverted: foo')),
    'reverted',
  );
  assert.equal(
    classifyStakingError(new Error('Failed to fetch')),
    'rpc_unavailable',
  );
  assert.equal(classifyStakingError(new Error('something else')), 'generic');
});
