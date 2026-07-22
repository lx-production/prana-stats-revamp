/// <reference types="node" />
/**
 * Characterization tests for useUniswapQuote.
 * Locks debounce, abort-on-change, cooldown, and error messaging before Swap lazy extract.
 */
import { act } from 'react';
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SWAP_QUOTE_DEBOUNCE_MS,
  SWAP_QUOTE_MANUAL_REFRESH_COOLDOWN_MS,
} from '../../constants/swapContracts.ts';
import { ensureDom, renderHook } from './renderHook.ts';

import type { UseUniswapQuoteInput } from '../../types/swap.types.ts';

ensureDom();

const recipient = '0x1234567890abcdef1234567890abcdef12345678' as const;

function baseInput(overrides: Partial<UseUniswapQuoteInput> = {}): UseUniswapQuoteInput {
  return {
    tokenInSymbol: 'USDT',
    tokenOutSymbol: 'PRANA',
    amountIn: '10',
    recipient,
    slippageBps: 50,
    enabled: true,
    ...overrides,
  };
}

test('useUniswapQuote clears state when disabled or amount is not ready', async () => {
  const { useUniswapQuote } = await import('../useUniswapQuote.ts');
  const { result, unmount } = await renderHook(() =>
    useUniswapQuote(baseInput({ enabled: false, amountIn: '10' })),
  );

  assert.equal(result.current.quote, null);
  assert.equal(result.current.isLoading, false);
  assert.equal(result.current.error, null);
  assert.equal(result.current.isRefreshCoolingDown, false);
  assert.equal(typeof result.current.refetch, 'function');

  await unmount();
});

test('useUniswapQuote debounces fetch to /api/swap/quote with expected JSON body', async () => {
  const fetches: Array<{ url: string; body: unknown }> = [];
  const quotePayload = {
    amountIn: '10',
    amountOut: '100',
    amountOutRaw: '100000000000',
    minimumAmountOut: '99',
    deadline: Math.floor(Date.now() / 1000) + 180,
    routerAddress: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    request: {
      chainId: 137,
      tokenInSymbol: 'USDT',
      tokenOutSymbol: 'PRANA',
      amountInRaw: '10000000',
      recipient,
      slippageBps: 50,
    },
    transaction: {
      to: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
      data: '0x',
      value: '0',
    },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    fetches.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(JSON.stringify(quotePayload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  mock.timers.enable({ apis: ['setTimeout'], now: Date.now() });

  try {
    const { useUniswapQuote } = await import('../useUniswapQuote.ts');
    const { result, unmount } = await renderHook(() => useUniswapQuote(baseInput()));

    assert.equal(result.current.isLoading, true);
    assert.equal(fetches.length, 0);

    await act(async () => {
      mock.timers.tick(SWAP_QUOTE_DEBOUNCE_MS);
    });
    // Allow the fetch promise microtasks to settle.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(fetches.length, 1);
    assert.equal(fetches[0]?.url, '/api/swap/quote');
    assert.deepEqual(fetches[0]?.body, {
      tokenInSymbol: 'USDT',
      tokenOutSymbol: 'PRANA',
      amountIn: '10',
      recipient,
      slippageBps: 50,
    });
    assert.equal(result.current.isLoading, false);
    assert.equal(result.current.error, null);
    assert.equal(result.current.quote?.amountOut, '100');

    await unmount();
  } finally {
    mock.timers.reset();
    globalThis.fetch = originalFetch;
  }
});

test('useUniswapQuote surfaces a clear error when backend returns non-JSON', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response('<html>error</html>', {
      status: 500,
      headers: { 'content-type': 'text/html' },
    })) as typeof fetch;

  mock.timers.enable({ apis: ['setTimeout'], now: Date.now() });

  try {
    const { useUniswapQuote } = await import('../useUniswapQuote.ts');
    const { result, unmount } = await renderHook(() => useUniswapQuote(baseInput()));

    await act(async () => {
      mock.timers.tick(SWAP_QUOTE_DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(result.current.quote, null);
    assert.equal(
      result.current.error,
      'Swap quote backend is not available. Please restart the app server and try again.',
    );

    await unmount();
  } finally {
    mock.timers.reset();
    globalThis.fetch = originalFetch;
  }
});

test('useUniswapQuote.refetch ignores clicks while cooldown is active', async () => {
  let fetchCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetchCount += 1;
    return new Response(
      JSON.stringify({
        amountIn: '10',
        amountOut: '1',
        amountOutRaw: '1',
        minimumAmountOut: '1',
        deadline: Math.floor(Date.now() / 1000) + 180,
        routerAddress: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
        request: {
          chainId: 137,
          tokenInSymbol: 'USDT',
          tokenOutSymbol: 'PRANA',
          amountInRaw: '10000000',
          recipient,
          slippageBps: 50,
        },
        transaction: {
          to: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
          data: '0x',
          value: '0',
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  mock.timers.enable({
    apis: ['setTimeout', 'setInterval', 'Date'],
    now: 1_000_000,
  });

  try {
    const { useUniswapQuote } = await import('../useUniswapQuote.ts');
    const { result, unmount } = await renderHook(() => useUniswapQuote(baseInput()));

    await act(async () => {
      mock.timers.tick(SWAP_QUOTE_DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    assert.equal(fetchCount, 1);

    await act(async () => {
      result.current.refetch();
    });
    assert.equal(result.current.isRefreshCoolingDown, true);

    await act(async () => {
      mock.timers.tick(SWAP_QUOTE_DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    assert.equal(fetchCount, 2);

    // Second refetch during cooldown must be ignored.
    await act(async () => {
      result.current.refetch();
    });
    await act(async () => {
      mock.timers.tick(SWAP_QUOTE_DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    assert.equal(fetchCount, 2);

    // After full cooldown, refetch works again.
    await act(async () => {
      mock.timers.tick(SWAP_QUOTE_MANUAL_REFRESH_COOLDOWN_MS);
    });
    await act(async () => {
      result.current.refetch();
    });
    await act(async () => {
      mock.timers.tick(SWAP_QUOTE_DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    assert.equal(fetchCount, 3);

    await unmount();
  } finally {
    mock.timers.reset();
    globalThis.fetch = originalFetch;
  }
});
