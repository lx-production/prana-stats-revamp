/// <reference types="node" />
/**
 * Characterization tests for useUniswapSwap (wagmi public/wallet clients).
 * Locks idle shape, quote-guard errors, and insufficient-balance messaging.
 */
import { act } from 'react';
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { V1_SWAP_TOKENS } from '../../../constants/swapContracts.ts';
import { ensureDom, renderHook } from '../../../hooks/tests/renderHook.ts';

import type { SwapQuoteResponse, SwapToken } from '../../../types/swap.types.ts';

ensureDom();

function token(symbol: SwapToken['symbol']): SwapToken {
  const found = V1_SWAP_TOKENS.find((entry) => entry.symbol === symbol);
  assert.ok(found);
  return found;
}

const owner = '0x1234567890abcdef1234567890abcdef12345678' as const;

let publicClientStub: {
  getBalance?: (args: unknown) => Promise<bigint>;
  readContract?: (args: unknown) => Promise<bigint>;
  waitForTransactionReceipt?: (args: unknown) => Promise<{ status: string }>;
} | null = null;

let walletClientStub: {
  writeContract?: (args: unknown) => Promise<`0x${string}`>;
  sendTransaction?: (args: unknown) => Promise<`0x${string}`>;
} | null = null;

mock.module('wagmi', {
  namedExports: {
    usePublicClient: () => publicClientStub,
    useWalletClient: () => ({ data: walletClientStub }),
  },
});

// Avoid real network logging during characterization.
mock.module('../utils/swapTransactionLogs.ts', {
  namedExports: {
    logSwapTransactionEvent: () => {},
  },
});

function makeQuote(overrides: Partial<SwapQuoteResponse> = {}): SwapQuoteResponse {
  const amountIn = '10';
  const usdt = token('USDT');
  const amountInRaw = (10n * 10n ** BigInt(usdt.decimals)).toString();

  return {
    amountIn,
    amountOut: '100',
    amountOutRaw: '100000000000',
    minimumAmountOut: '99',
    deadline: Math.floor(Date.now() / 1000) + 600,
    routerAddress: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    routeSummary: [],
    request: {
      chainId: 137,
      tokenInSymbol: 'USDT',
      tokenOutSymbol: 'PRANA',
      amountIn,
      amountInRaw,
      recipient: owner,
      slippageBps: 50,
    },
    transaction: {
      to: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
      data: '0xabc',
      value: '0',
    },
    ...overrides,
  } as SwapQuoteResponse;
}

test('useUniswapSwap idle shape with no quote / no wallet clients', async () => {
  publicClientStub = null;
  walletClientStub = null;

  const { useUniswapSwap } = await import('../hooks/useUniswapSwap.ts');
  const { result, unmount } = await renderHook(() =>
    useUniswapSwap({
      quote: null,
      tokenIn: token('USDT'),
      tokenOut: token('PRANA'),
      amountIn: '',
      slippageBps: 50,
      ownerAddress: undefined,
    }),
  );

  assert.equal(result.current.balance, null);
  assert.equal(result.current.allowance, null);
  assert.equal(result.current.isRefreshingBalances, false);
  assert.equal(result.current.isQuoteExpired, false);
  assert.equal(result.current.needsApproval, false);
  assert.equal(result.current.hasInsufficientBalance, false);
  assert.equal(result.current.status, 'idle');
  assert.equal(result.current.transactionHash, null);
  assert.equal(result.current.error, null);
  assert.equal(typeof result.current.executeSwap, 'function');
  assert.equal(typeof result.current.resetSwapState, 'function');
  assert.equal(typeof result.current.refreshBalances, 'function');

  await unmount();
});

test('useUniswapSwap.executeSwap requires a quote first', async () => {
  publicClientStub = null;
  walletClientStub = { sendTransaction: async () => '0xhash' };

  const { useUniswapSwap } = await import('../hooks/useUniswapSwap.ts');
  const { result, unmount } = await renderHook(() =>
    useUniswapSwap({
      quote: null,
      tokenIn: token('USDT'),
      tokenOut: token('PRANA'),
      amountIn: '10',
      slippageBps: 50,
      ownerAddress: owner,
    }),
  );

  await act(async () => {
    await result.current.executeSwap();
  });

  assert.equal(result.current.error, 'Load a quote before swapping.');
  assert.equal(result.current.status, 'idle');

  await unmount();
});

test('useUniswapSwap.executeSwap asks to connect wallet when quote is current but wallet missing', async () => {
  publicClientStub = {
    readContract: async () => 1_000_000_000n,
  };
  walletClientStub = null;

  const { useUniswapSwap } = await import('../hooks/useUniswapSwap.ts');
  const { result, unmount } = await renderHook(() =>
    useUniswapSwap({
      quote: makeQuote(),
      tokenIn: token('USDT'),
      tokenOut: token('PRANA'),
      amountIn: '10',
      slippageBps: 50,
      ownerAddress: owner,
    }),
  );

  // Allow balance refresh effect to settle.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  await act(async () => {
    await result.current.executeSwap();
  });

  assert.equal(result.current.error, 'Connect your Polygon wallet before swapping.');

  await unmount();
});

test('useUniswapSwap.executeSwap reports insufficient balance with token symbol', async () => {
  publicClientStub = {
    readContract: async () => 1n, // far below 10 USDT
  };
  walletClientStub = {
    writeContract: async () => '0xapprove',
    sendTransaction: async () => '0xswap',
  };

  const { useUniswapSwap } = await import('../hooks/useUniswapSwap.ts');
  const { result, unmount } = await renderHook(() =>
    useUniswapSwap({
      quote: makeQuote(),
      tokenIn: token('USDT'),
      tokenOut: token('PRANA'),
      amountIn: '10',
      slippageBps: 50,
      ownerAddress: owner,
    }),
  );

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.equal(result.current.hasInsufficientBalance, true);

  await act(async () => {
    await result.current.executeSwap();
  });

  assert.equal(result.current.error, 'Insufficient USDT balance.');

  await unmount();
});

test('useUniswapSwap.resetSwapState returns to idle and clears error/hash', async () => {
  publicClientStub = null;
  walletClientStub = null;

  const { useUniswapSwap } = await import('../hooks/useUniswapSwap.ts');
  const { result, unmount } = await renderHook(() =>
    useUniswapSwap({
      quote: null,
      tokenIn: token('USDT'),
      tokenOut: token('PRANA'),
      amountIn: '10',
      slippageBps: 50,
      ownerAddress: owner,
    }),
  );

  await act(async () => {
    await result.current.executeSwap();
  });
  assert.equal(result.current.error, 'Load a quote before swapping.');

  await act(async () => {
    result.current.resetSwapState();
  });

  assert.equal(result.current.status, 'idle');
  assert.equal(result.current.error, null);
  assert.equal(result.current.transactionHash, null);

  await unmount();
});
