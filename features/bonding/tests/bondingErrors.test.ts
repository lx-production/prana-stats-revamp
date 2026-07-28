/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyBondingError } from '../bondingErrors.ts';

test('classifyBondingError maps rejection, chain, gas, allowance, pause, treasury, reserve, RPC', () => {
  assert.equal(
    classifyBondingError(new Error('User rejected the request')),
    'user_rejected',
  );
  assert.equal(
    classifyBondingError(new Error('User denied transaction signature')),
    'user_rejected',
  );
  assert.equal(
    classifyBondingError(new Error('active chainId is different from ...')),
    'wrong_chain',
  );
  assert.equal(
    classifyBondingError(new Error('insufficient funds for gas')),
    'insufficient_gas',
  );
  assert.equal(
    classifyBondingError(new Error('ERC20: insufficient allowance')),
    'insufficient_allowance',
  );
  assert.equal(
    classifyBondingError(new Error('transfer amount exceeds balance')),
    'insufficient_balance',
  );
  assert.equal(
    classifyBondingError(new Error('EnforcedPause()')),
    'paused',
  );
  assert.equal(
    classifyBondingError(new Error('insufficient treasury capacity')),
    'insufficient_treasury',
  );
  assert.equal(
    classifyBondingError(new Error('exceeds reserve')),
    'exceeds_reserve',
  );
  assert.equal(
    classifyBondingError(new Error('execution reverted: foo')),
    'reverted',
  );
  assert.equal(
    classifyBondingError(new Error('Failed to fetch')),
    'rpc_unavailable',
  );
  assert.equal(
    classifyBondingError(new Error('RPC URL https://secret.example')),
    'rpc_unavailable',
  );
  assert.equal(classifyBondingError(new Error('something else')), 'generic');
});

test('classifyBondingError never returns raw provider secrets as codes', () => {
  const code = classifyBondingError(
    new Error('JSON-RPC error at https://polygon-rpc.example/key=abc'),
  );
  assert.equal(code, 'rpc_unavailable');
  assert.notEqual(code, 'https://polygon-rpc.example/key=abc');
});
