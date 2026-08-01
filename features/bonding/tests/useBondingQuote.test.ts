/// <reference types="node" />
/**
 * Quote hook tests: debounce, abort, stale mark, freshQuote, out-of-order drop.
 */
import { act } from 'react';
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureDom, renderHook } from '../../../hooks/tests/renderHook.ts';
import {
  BONDING_QUOTE_DEBOUNCE_MS,
  BONDING_QUOTE_STALE_MS,
  buildBondingQuoteRequest,
} from '../hooks/useBondingQuote.ts';

import type { BondingQuote, BondingQuoteRequest } from '../bonding.types.ts';

ensureDom();

function sampleQuote(
  overrides: Partial<BondingQuote> = {},
): BondingQuote {
  return {
    mode: 'buy_exact_wbtc',
    termId: 1,
    wbtcAmountRaw: '1000000',
    pranaAmountRaw: '500000000000',
    rateBpsRaw: '500',
    durationSeconds: 2_592_000,
    blockNumber: 1,
    blockTimestamp: 1_700_000_000,
    reserveSource: 'impacted',
    issues: [],
    ...overrides,
  };
}

function baseRequest(
  overrides: Partial<BondingQuoteRequest> = {},
): BondingQuoteRequest {
  return {
    mode: 'buy_exact_wbtc',
    amountRaw: '1000000',
    termId: 1,
    ...overrides,
  };
}

test('buildBondingQuoteRequest maps side to discriminated union', () => {
  assert.deepEqual(
    buildBondingQuoteRequest({
      side: 'buy',
      amountRaw: 10n,
      termId: 1,
    }),
    { mode: 'buy_exact_wbtc', amountRaw: '10', termId: 1 },
  );
  assert.deepEqual(
    buildBondingQuoteRequest({
      side: 'sell',
      amountRaw: 30n,
      termId: 0,
    }),
    { mode: 'sell_exact_prana', amountRaw: '30', termId: 0 },
  );
  assert.equal(
    buildBondingQuoteRequest({
      side: 'buy',
      amountRaw: null,
      termId: 1,
    }),
    null,
  );
});

test('useBondingQuote clears state when disabled or request is null', async () => {
  const { useBondingQuote } = await import('../hooks/useBondingQuote.ts');
  const { result, unmount } = await renderHook(() =>
    useBondingQuote({ enabled: false, request: baseRequest() }),
  );

  assert.equal(result.current.quote, null);
  assert.equal(result.current.isLoading, false);
  assert.equal(result.current.error, null);
  assert.equal(result.current.isStale, false);

  await unmount();
});

test('useBondingQuote debounces — only the last typed request is sent', async () => {
  const fetches: Array<{ body: unknown; signal?: AbortSignal }> = [];
  let releaseFetch: (() => void) | null = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    fetches.push({
      body: init?.body ? JSON.parse(String(init.body)) : null,
      signal: init?.signal ?? undefined,
    });
    // Hold the response so we can observe isLoading === true mid-flight.
    await new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    return new Response(JSON.stringify(sampleQuote()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_000 });

  try {
    const { useBondingQuote } = await import('../hooks/useBondingQuote.ts');

    let amountRaw = '100';
    const { result, rerender, unmount } = await renderHook(() =>
      useBondingQuote({
        enabled: true,
        request: baseRequest({ amountRaw }),
      }),
    );

    // During the debounce window: no network yet, and no loading flash.
    assert.equal(result.current.isLoading, false);
    assert.equal(fetches.length, 0);

    // Type again before debounce fires — previous timer must be cancelled.
    amountRaw = '200';
    await act(async () => {
      rerender();
    });
    assert.equal(result.current.isLoading, false);
    assert.equal(fetches.length, 0);

    amountRaw = '300';
    await act(async () => {
      rerender();
    });
    assert.equal(result.current.isLoading, false);
    assert.equal(fetches.length, 0);

    // Advance almost to the deadline — still quiet.
    await act(async () => {
      mock.timers.tick(BONDING_QUOTE_DEBOUNCE_MS - 1);
    });
    assert.equal(fetches.length, 0);
    assert.equal(result.current.isLoading, false);

    await act(async () => {
      mock.timers.tick(1);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Loading flips only when the debounced fetch starts.
    assert.equal(fetches.length, 1);
    assert.equal(result.current.isLoading, true);
    assert.deepEqual(fetches[0]?.body, {
      mode: 'buy_exact_wbtc',
      amountRaw: '300',
      termId: 1,
    });

    await act(async () => {
      releaseFetch?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(result.current.quote?.wbtcAmountRaw, '1000000');
    assert.equal(result.current.isLoading, false);

    await unmount();
  } finally {
    mock.timers.reset();
    globalThis.fetch = originalFetch;
  }
});

test('useBondingQuote aborts in-flight request when inputs change', async () => {
  const signals: AbortSignal[] = [];
  let resolveFirst: ((value: Response) => void) | null = null;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.signal) signals.push(init.signal);
    if (signals.length === 1) {
      return await new Promise<Response>((resolve) => {
        resolveFirst = resolve;
      });
    }
    return new Response(
      JSON.stringify(sampleQuote({ wbtcAmountRaw: '999', pranaAmountRaw: '1' })),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 2_000 });

  try {
    const { useBondingQuote } = await import('../hooks/useBondingQuote.ts');

    let amountRaw = '100';
    const { result, rerender, unmount } = await renderHook(() =>
      useBondingQuote({
        enabled: true,
        request: baseRequest({ amountRaw }),
      }),
    );

    await act(async () => {
      mock.timers.tick(BONDING_QUOTE_DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
    });
    assert.equal(signals.length, 1);

    // Change input — abort the first in-flight fetch.
    amountRaw = '200';
    await act(async () => {
      rerender();
    });
    await act(async () => {
      mock.timers.tick(BONDING_QUOTE_DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(signals[0]?.aborted, true);
    assert.equal(signals.length, 2);

    // Late resolve of the aborted request must not overwrite the new quote.
    await act(async () => {
      resolveFirst?.(
        new Response(
          JSON.stringify(sampleQuote({ wbtcAmountRaw: 'STALE' })),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(result.current.quote?.wbtcAmountRaw, '999');

    await unmount();
  } finally {
    mock.timers.reset();
    globalThis.fetch = originalFetch;
  }
});

test('useBondingQuote marks quote stale after 60 seconds; freshQuote bypasses debounce', async () => {
  let fetchCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetchCount += 1;
    return new Response(
      JSON.stringify(sampleQuote({ wbtcAmountRaw: String(fetchCount) })),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  mock.timers.enable({
    apis: ['setTimeout', 'setInterval', 'Date'],
    now: 10_000,
  });

  try {
    const { useBondingQuote } = await import('../hooks/useBondingQuote.ts');
    const { result, unmount } = await renderHook(() =>
      useBondingQuote({ enabled: true, request: baseRequest() }),
    );

    await act(async () => {
      mock.timers.tick(BONDING_QUOTE_DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(fetchCount, 1);
    assert.equal(result.current.isStale, false);
    assert.equal(result.current.quote?.wbtcAmountRaw, '1');

    await act(async () => {
      mock.timers.tick(BONDING_QUOTE_STALE_MS);
    });
    assert.equal(result.current.isStale, true);

    let fresh: BondingQuote | null = null;
    await act(async () => {
      fresh = await result.current.freshQuote();
    });

    assert.equal(fetchCount, 2);
    assert.equal(fresh?.wbtcAmountRaw, '2');
    assert.equal(result.current.quote?.wbtcAmountRaw, '2');
    assert.equal(result.current.isStale, false);

    await unmount();
  } finally {
    mock.timers.reset();
    globalThis.fetch = originalFetch;
  }
});

test('useBondingQuote abort rejection does not set error UI', async () => {
  const signals: AbortSignal[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const signal = init?.signal;
    if (signal) signals.push(signal);

    if (signals.length === 1) {
      return await new Promise<Response>((_resolve, reject) => {
        const onAbort = () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        };
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      });
    }

    return new Response(
      JSON.stringify(sampleQuote({ wbtcAmountRaw: '999', pranaAmountRaw: '1' })),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 4_000 });

  try {
    const { useBondingQuote } = await import('../hooks/useBondingQuote.ts');

    let amountRaw = '100';
    const { result, rerender, unmount } = await renderHook(() =>
      useBondingQuote({
        enabled: true,
        request: baseRequest({ amountRaw }),
      }),
    );

    await act(async () => {
      mock.timers.tick(BONDING_QUOTE_DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
    });
    assert.equal(signals.length, 1);

    amountRaw = '200';
    await act(async () => {
      rerender();
    });
    await act(async () => {
      mock.timers.tick(BONDING_QUOTE_DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(signals[0]?.aborted, true);
    assert.equal(result.current.error, null);
    assert.equal(result.current.quote?.wbtcAmountRaw, '999');

    await unmount();
  } finally {
    mock.timers.reset();
    globalThis.fetch = originalFetch;
  }
});

test('freshQuote skips debounce and aborts the in-flight auto-quote', async () => {
  const signals: AbortSignal[] = [];
  let fetchCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    fetchCount += 1;
    if (init?.signal) signals.push(init.signal);

    if (fetchCount === 1) {
      return await new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        const onAbort = () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        };
        if (!signal) return;
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      });
    }

    return new Response(
      JSON.stringify(sampleQuote({ wbtcAmountRaw: '99' })),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  mock.timers.enable({
    apis: ['setTimeout', 'setInterval', 'Date'],
    now: 20_000,
  });

  try {
    const { useBondingQuote } = await import('../hooks/useBondingQuote.ts');
    const { result, unmount } = await renderHook(() =>
      useBondingQuote({ enabled: true, request: baseRequest() }),
    );

    await act(async () => {
      mock.timers.tick(BONDING_QUOTE_DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
    });
    assert.equal(fetchCount, 1);
    assert.equal(signals.length, 1);

    let fresh: BondingQuote | null = null;
    await act(async () => {
      fresh = await result.current.freshQuote();
    });

    assert.equal(signals[0]?.aborted, true);
    assert.equal(fetchCount, 2);
    assert.equal(fresh?.wbtcAmountRaw, '99');
    assert.equal(result.current.quote?.wbtcAmountRaw, '99');
    assert.equal(result.current.error, null);

    await unmount();
  } finally {
    mock.timers.reset();
    globalThis.fetch = originalFetch;
  }
});

test('invalidate clears quote when buy mode / side would change', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(sampleQuote()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;

  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 3_000 });

  try {
    const { useBondingQuote } = await import('../hooks/useBondingQuote.ts');
    const { result, unmount } = await renderHook(() =>
      useBondingQuote({ enabled: true, request: baseRequest() }),
    );

    await act(async () => {
      mock.timers.tick(BONDING_QUOTE_DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    assert.ok(result.current.quote);

    await act(async () => {
      result.current.invalidate();
    });

    assert.equal(result.current.quote, null);
    assert.equal(result.current.error, null);
    assert.equal(result.current.isLoading, false);

    await unmount();
  } finally {
    mock.timers.reset();
    globalThis.fetch = originalFetch;
  }
});
