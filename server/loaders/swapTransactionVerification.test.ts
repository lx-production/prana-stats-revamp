import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { POLYGON_CHAIN_ID, UNISWAP_SWAP_ROUTER_02_ADDRESS } from '../../constants/swapContracts.ts';
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
} from './swapQuoteVerification.ts';
import { verifyAndLogSwapTransaction } from './swapTransactionVerification.ts';

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
    deadline: Math.floor(Date.now() / 1000) + 20 * 60,
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

  await verifyAndLogSwapTransaction(buildRequest(), {
    getProvider: async () => createProvider({ calls }),
    logVerifiedSwapTransactionEvent: () => undefined,
  });

  assert.equal(swapQuoteVerificationTestUtils.getUsedSwapQuoteTokenCount(), 1);
  assert.equal(calls.getTransaction, 1);
  assert.equal(calls.getTransactionReceipt, 1);
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

test('expired used quote token entries are swept from the replay cache', () => {
  const quote = buildQuote();
  const expiresAt = Date.parse(quote.verification.expiresAt);

  markSwapQuoteTokenUsed(quote);
  assert.equal(swapQuoteVerificationTestUtils.getUsedSwapQuoteTokenCount(), 1);

  swapQuoteVerificationTestUtils.sweepUsedSwapQuoteTokens(expiresAt + 1);

  assert.equal(swapQuoteVerificationTestUtils.getUsedSwapQuoteTokenCount(), 0);
});
