import assert from 'node:assert/strict';
import { test } from 'node:test';

import { confirmTransactionOnChain } from '../utils/transactionConfirmationLookup.ts';

import type { Address, Hex } from '../../types/blockchain.types.ts';
import type {
  ConfirmationLookupProvider,
  ConfirmationMismatchReason,
  ExpectedCall,
} from '../types/transactionConfirmationTypes.ts';

const SAMPLE_TX_HASH =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex;
const SAMPLE_ACCOUNT =
  '0x1111111111111111111111111111111111111111' as Address;
const EXPECTED: ExpectedCall = {
  target: '0x2222222222222222222222222222222222222222' as Address,
  data: '0xabcdef' as Hex,
};

class TestMismatchError extends Error {
  reason: ConfirmationMismatchReason;

  constructor(reason: ConfirmationMismatchReason) {
    super(`mismatch:${reason}`);
    this.name = 'TestMismatchError';
    this.reason = reason;
  }
}

function createMismatchError(reason: ConfirmationMismatchReason): Error {
  return new TestMismatchError(reason);
}

function matchingProvider(
  overrides: {
    from?: string;
    to?: string | null;
    data?: string;
    status?: number | null;
    transaction?: null;
    receipt?: null;
  } = {},
): ConfirmationLookupProvider {
  const hasTx = !('transaction' in overrides && overrides.transaction === null);
  const hasReceipt = !('receipt' in overrides && overrides.receipt === null);

  return {
    async getTransaction() {
      if (!hasTx) return null;
      return {
        from: overrides.from ?? SAMPLE_ACCOUNT,
        to: 'to' in overrides ? overrides.to : EXPECTED.target,
        data: overrides.data ?? EXPECTED.data,
      };
    },
    async getTransactionReceipt() {
      if (!hasReceipt) return null;
      return {
        // Explicit null must stay null — never treat unknown status as revert.
        status: 'status' in overrides ? (overrides.status ?? null) : 1,
      };
    },
  };
}

test('confirmTransactionOnChain returns confirmed when receipt status is 1', async () => {
  const result = await confirmTransactionOnChain({
    transactionHash: SAMPLE_TX_HASH,
    account: SAMPLE_ACCOUNT,
    expectedCall: EXPECTED,
    getProvider: async () => matchingProvider(),
    createMismatchError,
  });

  assert.deepEqual(result, { status: 'confirmed', source: 'server' });
});

test('confirmTransactionOnChain returns reverted when receipt status is 0', async () => {
  const result = await confirmTransactionOnChain({
    transactionHash: SAMPLE_TX_HASH,
    account: SAMPLE_ACCOUNT,
    expectedCall: EXPECTED,
    getProvider: async () => matchingProvider({ status: 0 }),
    createMismatchError,
  });

  assert.deepEqual(result, { status: 'reverted', source: 'server' });
});

test('confirmTransactionOnChain returns not_mined when tx or receipt is missing', async () => {
  const missingTx = await confirmTransactionOnChain({
    transactionHash: SAMPLE_TX_HASH,
    account: SAMPLE_ACCOUNT,
    expectedCall: EXPECTED,
    getProvider: async () => matchingProvider({ transaction: null }),
    createMismatchError,
  });
  assert.deepEqual(missingTx, { status: 'not_mined' });

  const missingReceipt = await confirmTransactionOnChain({
    transactionHash: SAMPLE_TX_HASH,
    account: SAMPLE_ACCOUNT,
    expectedCall: EXPECTED,
    getProvider: async () => matchingProvider({ receipt: null }),
    createMismatchError,
  });
  assert.deepEqual(missingReceipt, { status: 'not_mined' });
});

test('confirmTransactionOnChain returns confirmation_unavailable on provider/RPC failure', async () => {
  const providerInitFail = await confirmTransactionOnChain({
    transactionHash: SAMPLE_TX_HASH,
    account: SAMPLE_ACCOUNT,
    expectedCall: EXPECTED,
    getProvider: async () => {
      throw new Error('provider init failed');
    },
    createMismatchError,
  });
  assert.deepEqual(providerInitFail, { status: 'confirmation_unavailable' });

  const rpcReadFail = await confirmTransactionOnChain({
    transactionHash: SAMPLE_TX_HASH,
    account: SAMPLE_ACCOUNT,
    expectedCall: EXPECTED,
    getProvider: async () => ({
      async getTransaction() {
        throw new Error('RPC down https://alchemy.com/v2/SECRET');
      },
      async getTransactionReceipt() {
        throw new Error('RPC down');
      },
    }),
    createMismatchError,
  });
  assert.deepEqual(rpcReadFail, { status: 'confirmation_unavailable' });
});

test('confirmTransactionOnChain treats null receipt status as confirmation_unavailable', async () => {
  const result = await confirmTransactionOnChain({
    transactionHash: SAMPLE_TX_HASH,
    account: SAMPLE_ACCOUNT,
    expectedCall: EXPECTED,
    getProvider: async () => matchingProvider({ status: null }),
    createMismatchError,
  });

  assert.deepEqual(result, { status: 'confirmation_unavailable' });
});

test('confirmTransactionOnChain throws feature mismatch errors for sender/target/calldata', async () => {
  await assert.rejects(
    () =>
      confirmTransactionOnChain({
        transactionHash: SAMPLE_TX_HASH,
        account: SAMPLE_ACCOUNT,
        expectedCall: EXPECTED,
        getProvider: async () =>
          matchingProvider({
            from: '0x00000000000000000000000000000000000000aa',
          }),
        createMismatchError,
      }),
    (err: unknown) =>
      err instanceof TestMismatchError && err.reason === 'sender',
  );

  await assert.rejects(
    () =>
      confirmTransactionOnChain({
        transactionHash: SAMPLE_TX_HASH,
        account: SAMPLE_ACCOUNT,
        expectedCall: EXPECTED,
        getProvider: async () =>
          matchingProvider({
            to: '0x3333333333333333333333333333333333333333',
          }),
        createMismatchError,
      }),
    (err: unknown) =>
      err instanceof TestMismatchError && err.reason === 'target',
  );

  await assert.rejects(
    () =>
      confirmTransactionOnChain({
        transactionHash: SAMPLE_TX_HASH,
        account: SAMPLE_ACCOUNT,
        expectedCall: EXPECTED,
        getProvider: async () => matchingProvider({ data: '0xdeadbeef' }),
        createMismatchError,
      }),
    (err: unknown) =>
      err instanceof TestMismatchError && err.reason === 'calldata',
  );
});

test('confirmTransactionOnChain compares account and calldata case-insensitively', async () => {
  const result = await confirmTransactionOnChain({
    transactionHash: SAMPLE_TX_HASH,
    account: SAMPLE_ACCOUNT.toUpperCase() as Address,
    expectedCall: {
      target: EXPECTED.target.toUpperCase() as Address,
      data: EXPECTED.data.toUpperCase() as Hex,
    },
    getProvider: async () =>
      matchingProvider({
        from: SAMPLE_ACCOUNT.toLowerCase(),
        to: EXPECTED.target.toLowerCase(),
        data: EXPECTED.data.toLowerCase(),
      }),
    createMismatchError,
  });

  assert.deepEqual(result, { status: 'confirmed', source: 'server' });
});
