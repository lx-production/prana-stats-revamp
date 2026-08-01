/// <reference types="node" />
/**
 * Quote hook tests: debounce, abort, stale mark, freshQuote, out-of-order drop.
 */
import { act } from 'react';
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureDom, renderHook } from '../../../hooks/tests/renderHook.ts';
import {
  STAKING_QUOTE_DEBOUNCE_MS,
  STAKING_QUOTE_STALE_MS,
  buildStakingQuoteRequest,
  stakingQuoteRequestKey,
} from '../hooks/useStakingQuote.ts';

import type { StakingQuote, StakingQuoteRequest } from '../staking.types.ts';

ensureDom();

function sampleQuote(
  overrides: Partial<StakingQuote> = {},
): StakingQuote {
  return {
    amountRaw: '100000000000',
    durationSeconds: 2_592_000,
    apr: 9,
    newStakeInterestRaw: '1000',
    interestBalanceRaw: '500000000000',
    totalInterestNeededRaw: '100000000000',
    availableInterestFundRaw: '400000000000',
    minStakeRaw: '100000000000',
    paused: false,
    blockNumber: 1,
    blockTimestamp: 1_700_000_000,
    issues: [],
    ...overrides,
  };
}

function baseRequest(
  overrides: Partial<StakingQuoteRequest> = {},
): StakingQuoteRequest {
  return {
    amountRaw: '100000000000',
    durationSeconds: 2_592_000,
    ...overrides,
  };
}

test('buildStakingQuoteRequest requires positive amount and duration', () => {
  assert.deepEqual(
    buildStakingQuoteRequest({
      amountRaw: 100n,
      durationSeconds: 86_400,
    }),
    { amountRaw: '100', durationSeconds: 86_400 },
  );
  assert.equal(
    buildStakingQuoteRequest({ amountRaw: null, durationSeconds: 86_400 }),
    null,
  );
  assert.equal(
    buildStakingQuoteRequest({ amountRaw: 0n, durationSeconds: 86_400 }),
    null,
  );
  assert.equal(
    buildStakingQuoteRequest({ amountRaw: 100n, durationSeconds: null }),
    null,
  );
});

test('stakingQuoteRequestKey changes when amount or duration changes', () => {
  const base = baseRequest();
  assert.deepEqual(stakingQuoteRequestKey(base), [
    '100000000000',
    2_592_000,
  ]);
  assert.notDeepEqual(
    stakingQuoteRequestKey(base),
    stakingQuoteRequestKey(baseRequest({ amountRaw: '200' })),
  );
  assert.notDeepEqual(
    stakingQuoteRequestKey(base),
    stakingQuoteRequestKey(baseRequest({ durationSeconds: 86_400 })),
  );
  assert.equal(stakingQuoteRequestKey(null), '');
});

test('useStakingQuote clears state when disabled or request is null', async () => {
  const { useStakingQuote } = await import('../hooks/useStakingQuote.ts');
  const { result, unmount } = await renderHook(() =>
    useStakingQuote({ enabled: false, request: baseRequest() }),
  );

  assert.equal(result.current.quote, null);
  assert.equal(result.current.isLoading, false);
  assert.equal(result.current.error, null);
  assert.equal(result.current.isStale, false);

  await unmount();
});

test('useStakingQuote debounces — only the last typed request is sent', async () => {
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
    const { useStakingQuote } = await import('../hooks/useStakingQuote.ts');

    let amountRaw = '100';
    const { result, rerender, unmount } = await renderHook(() =>
      useStakingQuote({
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
      mock.timers.tick(STAKING_QUOTE_DEBOUNCE_MS - 1);
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
      amountRaw: '300',
      durationSeconds: 2_592_000,
    });

    await act(async () => {
      releaseFetch?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(result.current.quote?.amountRaw, '100000000000');
    assert.equal(result.current.isLoading, false);

    await unmount();
  } finally {
    mock.timers.reset();
    globalThis.fetch = originalFetch;
  }
});

test('useStakingQuote aborts in-flight request when inputs change', async () => {
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
      JSON.stringify(sampleQuote({ amountRaw: '999', blockNumber: 2 })),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 2_000 });

  try {
    const { useStakingQuote } = await import('../hooks/useStakingQuote.ts');

    let amountRaw = '100';
    const { result, rerender, unmount } = await renderHook(() =>
      useStakingQuote({
        enabled: true,
        request: baseRequest({ amountRaw }),
      }),
    );

    await act(async () => {
      mock.timers.tick(STAKING_QUOTE_DEBOUNCE_MS);
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
      mock.timers.tick(STAKING_QUOTE_DEBOUNCE_MS);
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
          JSON.stringify(sampleQuote({ amountRaw: 'STALE' })),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(result.current.quote?.amountRaw, '999');

    await unmount();
  } finally {
    mock.timers.reset();
    globalThis.fetch = originalFetch;
  }
});

test('useStakingQuote marks quote stale after 60 seconds; freshQuote bypasses debounce', async () => {
  let fetchCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetchCount += 1;
    return new Response(
      JSON.stringify(sampleQuote({ blockNumber: fetchCount })),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  mock.timers.enable({
    apis: ['setTimeout', 'setInterval', 'Date'],
    now: 10_000,
  });

  try {
    const { useStakingQuote } = await import('../hooks/useStakingQuote.ts');
    const { result, unmount } = await renderHook(() =>
      useStakingQuote({ enabled: true, request: baseRequest() }),
    );

    await act(async () => {
      mock.timers.tick(STAKING_QUOTE_DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(fetchCount, 1);
    assert.equal(result.current.isStale, false);
    assert.equal(result.current.quote?.blockNumber, 1);

    await act(async () => {
      mock.timers.tick(STAKING_QUOTE_STALE_MS);
    });
    assert.equal(result.current.isStale, true);

    let fresh: StakingQuote | null = null;
    await act(async () => {
      fresh = await result.current.freshQuote();
    });

    assert.equal(fetchCount, 2);
    assert.equal(fresh?.blockNumber, 2);
    assert.equal(result.current.quote?.blockNumber, 2);
    assert.equal(result.current.isStale, false);

    await unmount();
  } finally {
    mock.timers.reset();
    globalThis.fetch = originalFetch;
  }
});

test('useStakingQuote abort rejection does not set error UI', async () => {
  const signals: AbortSignal[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const signal = init?.signal;
    if (signal) signals.push(signal);

    // First in-flight request rejects with AbortError when cancelled.
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
      JSON.stringify(sampleQuote({ amountRaw: '999', blockNumber: 2 })),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 4_000 });

  try {
    const { useStakingQuote } = await import('../hooks/useStakingQuote.ts');

    let amountRaw = '100';
    const { result, rerender, unmount } = await renderHook(() =>
      useStakingQuote({
        enabled: true,
        request: baseRequest({ amountRaw }),
      }),
    );

    await act(async () => {
      mock.timers.tick(STAKING_QUOTE_DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
    });
    assert.equal(signals.length, 1);

    // Change inputs — abort the first fetch; AbortError must not become UI error.
    amountRaw = '200';
    await act(async () => {
      rerender();
    });
    await act(async () => {
      mock.timers.tick(STAKING_QUOTE_DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(signals[0]?.aborted, true);
    assert.equal(result.current.error, null);
    assert.equal(result.current.quote?.amountRaw, '999');

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

    // Hold the first (debounced) request until abort / never resolve on its own.
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
      JSON.stringify(sampleQuote({ blockNumber: 99 })),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  mock.timers.enable({
    apis: ['setTimeout', 'setInterval', 'Date'],
    now: 20_000,
  });

  try {
    const { useStakingQuote } = await import('../hooks/useStakingQuote.ts');
    const { result, unmount } = await renderHook(() =>
      useStakingQuote({ enabled: true, request: baseRequest() }),
    );

    // Let the debounced auto-quote start, then call freshQuote without waiting.
    await act(async () => {
      mock.timers.tick(STAKING_QUOTE_DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
    });
    assert.equal(fetchCount, 1);
    assert.equal(signals.length, 1);

    let fresh: StakingQuote | null = null;
    await act(async () => {
      fresh = await result.current.freshQuote();
    });

    assert.equal(signals[0]?.aborted, true);
    assert.equal(fetchCount, 2);
    assert.equal(fresh?.blockNumber, 99);
    assert.equal(result.current.quote?.blockNumber, 99);
    assert.equal(result.current.error, null);

    await unmount();
  } finally {
    mock.timers.reset();
    globalThis.fetch = originalFetch;
  }
});
