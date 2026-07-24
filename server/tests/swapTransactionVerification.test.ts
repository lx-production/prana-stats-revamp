import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { POLYGON_CHAIN_ID } from '../../constants/network.ts';
import { SWAP_DEADLINE_SECONDS, UNISWAP_SWAP_ROUTER_02_ADDRESS } from '../../constants/swapContracts.ts';
import type {
  HexAddress,
  SwapQuoteResponse,
  SwapTransactionVerificationRequest,
} from '../../types/swap.types.ts';
import { getSwapToken } from '../../utils/swapTokens.ts';
import {
  attachSwapQuoteVerification,
  markSwapQuoteTokenUsed,
  swapQuoteVerificationTestUtils,
} from '../loaders/swapQuoteVerification.ts';
import { verifyAndLogSwapTransaction } from '../loaders/swapTransactionVerification.ts';

const OWNER_ADDRESS = '0x0000000000000000000000000000000000000001' as HexAddress;
const TRANSACTION_HASH = `0x${'1'.repeat(64)}` as HexAddress;
const TRANSACTION_DATA = '0x1234' as HexAddress;

afterEach(() => {
  swapQuoteVerificationTestUtils.clearUsedSwapQuoteTokens();
});

function buildQuote(): SwapQuoteResponse {
  return attachSwapQuoteVerification({
    request: {
      tokenInSymbol: 'WBTC',
      tokenOutSymbol: 'PRANA',
      amountIn: '0.001',
      amountInRaw: '100000',
      recipient: OWNER_ADDRESS,
      slippageBps: 50,
      chainId: POLYGON_CHAIN_ID,
    },
    tokenIn: getSwapToken('WBTC'),
    tokenOut: getSwapToken('PRANA'),
    amountIn: '0.001',
    amountOut: '1000',
    amountOutRaw: '1000000000000000000000',
    minimumAmountOut: '995000000000000000000',
    route: [{ protocol: 'Uniswap V3', path: ['WBTC', 'PRANA'], percent: 100 }],
    estimatedGasUsed: '100000',
    routerAddress: UNISWAP_SWAP_ROUTER_02_ADDRESS,
    transaction: {
      to: UNISWAP_SWAP_ROUTER_02_ADDRESS,
      data: TRANSACTION_DATA,
      value: '0',
    },
    deadline: Math.floor(Date.now() / 1000) + SWAP_DEADLINE_SECONDS,
    quoteUpdatedAt: new Date().toISOString(),
  });
}

function buildRequest(quote = buildQuote()): SwapTransactionVerificationRequest {
  return {
    ownerAddress: OWNER_ADDRESS,
    transactionHash: TRANSACTION_HASH,
    quote,
  };
}

function createProvider(options: {
  transaction?: {
    from: string;
    to?: string | null;
    data: string;
    value: { toString(): string };
  } | null;
  receipt?: { status: number | null } | null;
  calls: { getTransaction: number; getTransactionReceipt: number };
}) {
  return {
    async getTransaction() {
      options.calls.getTransaction += 1;
      return 'transaction' in options ? options.transaction ?? null : {
        from: OWNER_ADDRESS,
        to: UNISWAP_SWAP_ROUTER_02_ADDRESS,
        data: TRANSACTION_DATA,
        value: 0n,
      };
    },
    async getTransactionReceipt() {
      options.calls.getTransactionReceipt += 1;
      return 'receipt' in options ? options.receipt ?? null : { status: 1 };
    },
  };
}

test('successful swap verification marks the quote token as used', async () => {
  const calls = { getTransaction: 0, getTransactionReceipt: 0 };
  let capturedMetadata: unknown;

  await verifyAndLogSwapTransaction(buildRequest(), {
    getProvider: async () => createProvider({ calls }),
    logVerifiedSwapTransactionEvent: (_payload, metadata) => {
      capturedMetadata = metadata;
    },
    logMetadata: {
      clientIp: '198.51.100.100',
      requestHost: 'example.test',
      requestOrigin: 'https://example.test',
      userAgent: 'swap-test',
    },
  });

  assert.equal(swapQuoteVerificationTestUtils.getUsedSwapQuoteTokenCount(), 1);
  assert.equal(calls.getTransaction, 1);
  assert.equal(calls.getTransactionReceipt, 1);
  assert.deepEqual(capturedMetadata, {
    clientIp: '198.51.100.100',
    requestHost: 'example.test',
    requestOrigin: 'https://example.test',
    userAgent: 'swap-test',
  });
});

test('replayed quote token is rejected before provider RPC calls', async () => {
  const quote = buildQuote();
  const firstCalls = { getTransaction: 0, getTransactionReceipt: 0 };

  await verifyAndLogSwapTransaction(buildRequest(quote), {
    getProvider: async () => createProvider({ calls: firstCalls }),
    logVerifiedSwapTransactionEvent: () => undefined,
  });

  let providerLoaded = false;
  await assert.rejects(
    verifyAndLogSwapTransaction(buildRequest(quote), {
      getProvider: async () => {
        providerLoaded = true;
        return createProvider({ calls: { getTransaction: 0, getTransactionReceipt: 0 } });
      },
      logVerifiedSwapTransactionEvent: () => undefined,
    }),
    /already been used/,
  );

  assert.equal(providerLoaded, false);
});

test('tampered verified log amount is rejected before provider RPC calls', async () => {
  const quote = buildQuote();
  const tamperedQuote = {
    ...quote,
    amountOut: '999999999',
  };

  let providerLoaded = false;
  await assert.rejects(
    verifyAndLogSwapTransaction(buildRequest(tamperedQuote), {
      getProvider: async () => {
        providerLoaded = true;
        return createProvider({ calls: { getTransaction: 0, getTransactionReceipt: 0 } });
      },
      logVerifiedSwapTransactionEvent: () => undefined,
    }),
    /verification is invalid/,
  );

  assert.equal(providerLoaded, false);
  assert.equal(swapQuoteVerificationTestUtils.getUsedSwapQuoteTokenCount(), 0);
});

test('tampered verified log route is rejected before provider RPC calls', async () => {
  const quote = buildQuote();
  const tamperedQuote = {
    ...quote,
    route: [{ protocol: 'Uniswap V2', path: ['WBTC', 'USDC', 'PRANA'], percent: 100 }],
  };

  let providerLoaded = false;
  await assert.rejects(
    verifyAndLogSwapTransaction(buildRequest(tamperedQuote), {
      getProvider: async () => {
        providerLoaded = true;
        return createProvider({ calls: { getTransaction: 0, getTransactionReceipt: 0 } });
      },
      logVerifiedSwapTransactionEvent: () => undefined,
    }),
    /verification is invalid/,
  );

  assert.equal(providerLoaded, false);
  assert.equal(swapQuoteVerificationTestUtils.getUsedSwapQuoteTokenCount(), 0);
});

// HMAC covers the signed quote fields — any edit must fail before paid RPC.
async function assertHmacRejectedBeforeRpc(
  quote: SwapQuoteResponse,
  expectedError: RegExp,
): Promise<void> {
  let providerLoaded = false;

  await assert.rejects(
    verifyAndLogSwapTransaction(buildRequest(quote), {
      getProvider: async () => {
        providerLoaded = true;
        return createProvider({ calls: { getTransaction: 0, getTransactionReceipt: 0 } });
      },
      logVerifiedSwapTransactionEvent: () => undefined,
    }),
    expectedError,
  );

  assert.equal(providerLoaded, false);
  assert.equal(swapQuoteVerificationTestUtils.getUsedSwapQuoteTokenCount(), 0);
}

test('tampered transaction calldata is rejected by HMAC before provider RPC calls', async () => {
  const quote = buildQuote();

  await assertHmacRejectedBeforeRpc({
    ...quote,
    transaction: {
      ...quote.transaction,
      data: '0xdeadbeef' as HexAddress,
    },
  }, /verification is invalid/);
});

test('tampered quote recipient is rejected by HMAC before provider RPC calls', async () => {
  const quote = buildQuote();

  await assertHmacRejectedBeforeRpc({
    ...quote,
    request: {
      ...quote.request,
      recipient: '0x00000000000000000000000000000000000000aa' as HexAddress,
    },
  }, /verification is invalid/);
});

test('tampered amountIn is rejected by HMAC before provider RPC calls', async () => {
  const quote = buildQuote();

  await assertHmacRejectedBeforeRpc({
    ...quote,
    amountIn: '999',
  }, /verification is invalid/);
});

test('tampered minimumAmountOut is rejected by HMAC before provider RPC calls', async () => {
  const quote = buildQuote();

  await assertHmacRejectedBeforeRpc({
    ...quote,
    minimumAmountOut: '1',
  }, /verification is invalid/);
});

test('tampered deadline is rejected by HMAC before provider RPC calls', async () => {
  const quote = buildQuote();

  await assertHmacRejectedBeforeRpc({
    ...quote,
    deadline: quote.deadline + 60,
  }, /verification is invalid/);
});

test('expired quote verification is rejected before provider RPC calls', async () => {
  const quote = buildQuote();

  await assertHmacRejectedBeforeRpc({
    ...quote,
    verification: {
      ...quote.verification,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    },
  }, /has expired/);
});

test('missing quote verification is rejected before provider RPC calls', async () => {
  const quote = buildQuote();
  const { verification: _removed, ...quoteWithoutVerification } = quote;

  await assertHmacRejectedBeforeRpc(
    quoteWithoutVerification as SwapQuoteResponse,
    /verification is missing/,
  );
});

test('wrong quote verification version is rejected before provider RPC calls', async () => {
  const quote = buildQuote();

  await assertHmacRejectedBeforeRpc({
    ...quote,
    verification: {
      ...quote.verification,
      // Force an old token version the server no longer accepts
      version: 1 as SwapQuoteResponse['verification']['version'],
    },
  }, /verification is missing/);
});

test('pending verification attempts do not consume the quote token', async () => {
  const quote = buildQuote();
  const pendingCalls = { getTransaction: 0, getTransactionReceipt: 0 };

  await assert.rejects(
    verifyAndLogSwapTransaction(buildRequest(quote), {
      getProvider: async () => createProvider({
        transaction: null,
        receipt: null,
        calls: pendingCalls,
      }),
      logVerifiedSwapTransactionEvent: () => undefined,
    }),
    /not confirmed yet/,
  );

  assert.equal(swapQuoteVerificationTestUtils.getUsedSwapQuoteTokenCount(), 0);

  const successCalls = { getTransaction: 0, getTransactionReceipt: 0 };
  await verifyAndLogSwapTransaction(buildRequest(quote), {
    getProvider: async () => createProvider({ calls: successCalls }),
    logVerifiedSwapTransactionEvent: () => undefined,
  });

  assert.equal(swapQuoteVerificationTestUtils.getUsedSwapQuoteTokenCount(), 1);
});

// Shared setup for on-chain mismatches: fail once, prove token unused, then succeed.
async function assertOnChainFailureDoesNotConsumeToken(options: {
  error: RegExp;
  transaction?: {
    from: string;
    to?: string | null;
    data: string;
    value: { toString(): string };
  };
  receipt?: { status: number | null };
}): Promise<void> {
  const quote = buildQuote();
  const failureCalls = { getTransaction: 0, getTransactionReceipt: 0 };

  await assert.rejects(
    verifyAndLogSwapTransaction(buildRequest(quote), {
      getProvider: async () => createProvider({
        ...(options.transaction ? { transaction: options.transaction } : {}),
        ...(options.receipt ? { receipt: options.receipt } : {}),
        calls: failureCalls,
      }),
      logVerifiedSwapTransactionEvent: () => undefined,
    }),
    options.error,
  );

  assert.equal(swapQuoteVerificationTestUtils.getUsedSwapQuoteTokenCount(), 0);
  assert.equal(failureCalls.getTransaction, 1);
  assert.equal(failureCalls.getTransactionReceipt, 1);

  // Failed checks must leave the quote usable for a later confirmed attempt
  const successCalls = { getTransaction: 0, getTransactionReceipt: 0 };
  await verifyAndLogSwapTransaction(buildRequest(quote), {
    getProvider: async () => createProvider({ calls: successCalls }),
    logVerifiedSwapTransactionEvent: () => undefined,
  });

  assert.equal(swapQuoteVerificationTestUtils.getUsedSwapQuoteTokenCount(), 1);
}

test('reverted receipt does not consume the quote token', async () => {
  await assertOnChainFailureDoesNotConsumeToken({
    receipt: { status: 0 },
    error: /did not succeed/,
  });
});

test('wrong transaction sender does not consume the quote token', async () => {
  await assertOnChainFailureDoesNotConsumeToken({
    transaction: {
      from: '0x00000000000000000000000000000000000000aa',
      to: UNISWAP_SWAP_ROUTER_02_ADDRESS,
      data: TRANSACTION_DATA,
      value: 0n,
    },
    error: /sender does not match/,
  });
});

test('wrong transaction target does not consume the quote token', async () => {
  await assertOnChainFailureDoesNotConsumeToken({
    transaction: {
      from: OWNER_ADDRESS,
      to: '0x00000000000000000000000000000000000000bb',
      data: TRANSACTION_DATA,
      value: 0n,
    },
    error: /target is invalid/,
  });
});

test('mismatched transaction calldata does not consume the quote token', async () => {
  await assertOnChainFailureDoesNotConsumeToken({
    transaction: {
      from: OWNER_ADDRESS,
      to: UNISWAP_SWAP_ROUTER_02_ADDRESS,
      data: '0xdead',
      value: 0n,
    },
    error: /calldata does not match/,
  });
});

test('mismatched transaction value does not consume the quote token', async () => {
  await assertOnChainFailureDoesNotConsumeToken({
    transaction: {
      from: OWNER_ADDRESS,
      to: UNISWAP_SWAP_ROUTER_02_ADDRESS,
      data: TRANSACTION_DATA,
      value: 1n,
    },
    error: /value does not match/,
  });
});

test('expired used quote token entries are swept from the replay cache', () => {
  const quote = buildQuote();
  const expiresAt = Date.parse(quote.verification.expiresAt);

  markSwapQuoteTokenUsed(quote);
  assert.equal(swapQuoteVerificationTestUtils.getUsedSwapQuoteTokenCount(), 1);

  swapQuoteVerificationTestUtils.sweepUsedSwapQuoteTokens(expiresAt + 1);

  assert.equal(swapQuoteVerificationTestUtils.getUsedSwapQuoteTokenCount(), 0);
});
