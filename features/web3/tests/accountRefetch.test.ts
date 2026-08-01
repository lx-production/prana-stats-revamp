/// <reference types="node" />
/**
 * Characterization tests for the shared account-refetch gate.
 * Covers stale-cache rejection, missing data, and case-insensitive address match.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accountFromSuccessfulRefetch } from '../accountRefetch.ts';

import type { Address } from '../../../types/blockchain.types.ts';

type SampleAccount = {
  address: string;
  balanceRaw: string;
};

const SAMPLE_ADDRESS =
  '0x1111111111111111111111111111111111111111' as Address;
const OTHER_ADDRESS =
  '0x2222222222222222222222222222222222222222' as Address;

const sampleAccount: SampleAccount = {
  address: SAMPLE_ADDRESS,
  balanceRaw: '1000000000000000000',
};

function successRefetch(data: SampleAccount = sampleAccount) {
  return { isSuccess: true, status: 'success', data, error: null };
}

function errorRefetch(cached: SampleAccount = sampleAccount) {
  // React Query keeps prior data when refetch fails — must not be treated as fresh.
  return {
    isSuccess: false,
    status: 'error',
    data: cached,
    error: new Error('network'),
  };
}

test('accountFromSuccessfulRefetch ignores failed refetch with stale data', () => {
  assert.equal(accountFromSuccessfulRefetch(errorRefetch()), undefined);
  assert.equal(accountFromSuccessfulRefetch(undefined), undefined);
  assert.equal(accountFromSuccessfulRefetch(null), undefined);
  assert.equal(accountFromSuccessfulRefetch({ data: sampleAccount }), undefined);
  assert.equal(
    accountFromSuccessfulRefetch({ status: 'error', error: new Error('x') }),
    undefined,
  );
  assert.equal(
    accountFromSuccessfulRefetch({ isSuccess: true, data: undefined }),
    undefined,
  );
});

test('accountFromSuccessfulRefetch accepts success and matches address case-insensitively', () => {
  assert.deepEqual(
    accountFromSuccessfulRefetch(successRefetch(), SAMPLE_ADDRESS),
    sampleAccount,
  );
  assert.deepEqual(
    accountFromSuccessfulRefetch(
      successRefetch(),
      SAMPLE_ADDRESS.toUpperCase() as Address,
    ),
    sampleAccount,
  );
  assert.equal(
    accountFromSuccessfulRefetch(successRefetch(), OTHER_ADDRESS),
    undefined,
  );
});
