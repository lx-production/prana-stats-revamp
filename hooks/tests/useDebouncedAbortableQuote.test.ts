/// <reference types="node" />
/**
 * Shared quote lifecycle: debounce, abort, race guard, stale mark, freshQuote.
 */
import { act } from 'react';
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDebouncedAbortableQuoteRequestKey,
  useDebouncedAbortableQuote,
} from '../useDebouncedAbortableQuote.ts';
import { ensureDom, renderHook } from './renderHook.ts';

ensureDom();

type SampleRequest = { amount: string; term: number };
type SampleQuote = { id: number; amount: string };

const DEBOUNCE_MS = 1000;
const STALE_MS = 60_000;
const FALLBACK = 'Failed to load quote.';

function requestKey(request: SampleRequest | null): string {
  if (!request) return '';
  return `${request.amount}:${request.term}`;
}

test('normalizeDebouncedAbortableQuoteRequestKey joins primitive tuples', () => {
  assert.equal(
    normalizeDebouncedAbortableQuoteRequestKey('already-string'),
    'already-string',
  );
  assert.equal(
    normalizeDebouncedAbortableQuoteRequestKey(['100', 30, true] as const),
    ['100', '30', 'true'].join('\0'),
  );
  assert.equal(
    normalizeDebouncedAbortableQuoteRequestKey(['a', null, undefined] as const),
    ['a', '', ''].join('\0'),
  );
});

test('disabled or null request resets state and does not fetch', async () => {
  let fetchCount = 0;
  const fetchQuote = async () => {
    fetchCount += 1;
    return { id: 1, amount: '1' };
  };

  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_000 });

  try {
    const { result, rerender, unmount } = await renderHook(() =>
      useDebouncedAbortableQuote<SampleRequest, SampleQuote>({
        enabled: false,
        request: { amount: '100', term: 1 },
        requestKey: requestKey({ amount: '100', term: 1 }),
        fetchQuote,
        debounceMs: DEBOUNCE_MS,
        staleMs: STALE_MS,
        fallbackErrorMessage: FALLBACK,
      }),
    );

    assert.equal(result.current.quote, null);
    assert.equal(result.current.isLoading, false);
    assert.equal(result.current.error, null);
    assert.equal(result.current.isStale, false);

    await act(async () => {
      mock.timers.tick(DEBOUNCE_MS);
    });
    assert.equal(fetchCount, 0);

    // enabled + null request still idle
    await act(async () => {
      await rerender(() =>
        useDebouncedAbortableQuote<SampleRequest, SampleQuote>({
          enabled: true,
          request: null,
          requestKey: '',
          fetchQuote,
          debounceMs: DEBOUNCE_MS,
          staleMs: STALE_MS,
          fallbackErrorMessage: FALLBACK,
        }),
      );
    });
    await act(async () => {
      mock.timers.tick(DEBOUNCE_MS);
    });
    assert.equal(fetchCount, 0);
    assert.equal(result.current.quote, null);

    await unmount();
  } finally {
    mock.timers.reset();
  }
});

test('input change before debounce cancels timer; loading only starts on fetch', async () => {
  const fetches: SampleRequest[] = [];
  let releaseFetch: (() => void) | null = null;

  const fetchQuote = async (request: SampleRequest, _signal: AbortSignal) => {
    fetches.push(request);
    await new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    return { id: fetches.length, amount: request.amount };
  };

  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 2_000 });

  try {
    let amount = '100';
    const { result, rerender, unmount } = await renderHook(() =>
      useDebouncedAbortableQuote<SampleRequest, SampleQuote>({
        enabled: true,
        request: { amount, term: 1 },
        requestKey: requestKey({ amount, term: 1 }),
        fetchQuote,
        debounceMs: DEBOUNCE_MS,
        staleMs: STALE_MS,
        fallbackErrorMessage: FALLBACK,
      }),
    );

    assert.equal(result.current.isLoading, false);
    assert.equal(fetches.length, 0);

    amount = '200';
    await act(async () => {
      rerender();
    });
    amount = '300';
    await act(async () => {
      rerender();
    });

    await act(async () => {
      mock.timers.tick(DEBOUNCE_MS - 1);
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

    assert.equal(fetches.length, 1);
    assert.equal(result.current.isLoading, true);
    assert.deepEqual(fetches[0], { amount: '300', term: 1 });

    await act(async () => {
      releaseFetch?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    assert.equal(result.current.quote?.amount, '300');
    assert.equal(result.current.isLoading, false);

    await unmount();
  } finally {
    mock.timers.reset();
  }
});

test('same requestKey with new object identity does not re-fetch', async () => {
  let fetchCount = 0;
  const fetchQuote = async (request: SampleRequest) => {
    fetchCount += 1;
    return { id: fetchCount, amount: request.amount };
  };

  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 3_000 });

  try {
    let request: SampleRequest = { amount: '100', term: 1 };
    const { result, rerender, unmount } = await renderHook(() =>
      useDebouncedAbortableQuote<SampleRequest, SampleQuote>({
        enabled: true,
        request,
        requestKey: requestKey(request),
        fetchQuote,
        debounceMs: DEBOUNCE_MS,
        staleMs: STALE_MS,
        fallbackErrorMessage: FALLBACK,
      }),
    );

    await act(async () => {
      mock.timers.tick(DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    assert.equal(fetchCount, 1);
    assert.equal(result.current.quote?.id, 1);

    // New object, same data / key — must not schedule another request.
    request = { amount: '100', term: 1 };
    await act(async () => {
      rerender();
    });
    await act(async () => {
      mock.timers.tick(DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    assert.equal(fetchCount, 1);
    assert.equal(result.current.quote?.id, 1);

    await unmount();
  } finally {
    mock.timers.reset();
  }
});

test('stale response does not overwrite newer quote', async () => {
  const signals: AbortSignal[] = [];
  let resolveFirst: ((value: SampleQuote) => void) | null = null;

  const fetchQuote = async (
    request: SampleRequest,
    signal: AbortSignal,
  ): Promise<SampleQuote> => {
    signals.push(signal);
    if (signals.length === 1) {
      // Hold until the test late-resolves — abort alone must not settle it.
      return await new Promise<SampleQuote>((resolve) => {
        resolveFirst = resolve;
      });
    }
    return { id: 2, amount: request.amount };
  };

  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 4_000 });

  try {
    let amount = '100';
    const { result, rerender, unmount } = await renderHook(() =>
      useDebouncedAbortableQuote<SampleRequest, SampleQuote>({
        enabled: true,
        request: { amount, term: 1 },
        requestKey: requestKey({ amount, term: 1 }),
        fetchQuote,
        debounceMs: DEBOUNCE_MS,
        staleMs: STALE_MS,
        fallbackErrorMessage: FALLBACK,
      }),
    );

    await act(async () => {
      mock.timers.tick(DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
    });
    assert.equal(signals.length, 1);

    amount = '200';
    await act(async () => {
      rerender();
    });
    await act(async () => {
      mock.timers.tick(DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(signals[0]?.aborted, true);
    assert.equal(signals.length, 2);
    assert.equal(result.current.quote?.amount, '200');

    // Late resolve of the aborted request must not overwrite the newer quote.
    await act(async () => {
      resolveFirst?.({ id: 1, amount: 'STALE' });
      await Promise.resolve();
      await Promise.resolve();
    });
    assert.equal(result.current.quote?.amount, '200');
    assert.equal(result.current.error, null);

    await unmount();
  } finally {
    mock.timers.reset();
  }
});

test('AbortError rejection does not set error UI', async () => {
  const signals: AbortSignal[] = [];

  const fetchQuote = async (
    request: SampleRequest,
    signal: AbortSignal,
  ): Promise<SampleQuote> => {
    signals.push(signal);
    if (signals.length === 1) {
      return await new Promise<SampleQuote>((_resolve, reject) => {
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
    return { id: 2, amount: request.amount };
  };

  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 4_500 });

  try {
    let amount = '100';
    const { result, rerender, unmount } = await renderHook(() =>
      useDebouncedAbortableQuote<SampleRequest, SampleQuote>({
        enabled: true,
        request: { amount, term: 1 },
        requestKey: requestKey({ amount, term: 1 }),
        fetchQuote,
        debounceMs: DEBOUNCE_MS,
        staleMs: STALE_MS,
        fallbackErrorMessage: FALLBACK,
      }),
    );

    await act(async () => {
      mock.timers.tick(DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
    });

    amount = '200';
    await act(async () => {
      rerender();
    });
    await act(async () => {
      mock.timers.tick(DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(signals[0]?.aborted, true);
    assert.equal(result.current.error, null);
    assert.equal(result.current.quote?.amount, '200');

    await unmount();
  } finally {
    mock.timers.reset();
  }
});

test('network error sets fallback message for non-Error throws', async () => {
  const fetchQuote = async () => {
    throw 'boom';
  };

  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 5_000 });

  try {
    const { result, unmount } = await renderHook(() =>
      useDebouncedAbortableQuote<SampleRequest, SampleQuote>({
        enabled: true,
        request: { amount: '100', term: 1 },
        requestKey: '100:1',
        fetchQuote,
        debounceMs: DEBOUNCE_MS,
        staleMs: STALE_MS,
        fallbackErrorMessage: FALLBACK,
      }),
    );

    await act(async () => {
      mock.timers.tick(DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(result.current.quote, null);
    assert.equal(result.current.error, FALLBACK);
    assert.equal(result.current.isLoading, false);

    await unmount();
  } finally {
    mock.timers.reset();
  }
});

test('quote becomes stale after staleMs; freshQuote bypasses debounce', async () => {
  let fetchCount = 0;
  const fetchQuote = async (request: SampleRequest) => {
    fetchCount += 1;
    return { id: fetchCount, amount: request.amount };
  };

  mock.timers.enable({
    apis: ['setTimeout', 'setInterval', 'Date'],
    now: 10_000,
  });

  try {
    const { result, unmount } = await renderHook(() =>
      useDebouncedAbortableQuote<SampleRequest, SampleQuote>({
        enabled: true,
        request: { amount: '100', term: 1 },
        requestKey: '100:1',
        fetchQuote,
        debounceMs: DEBOUNCE_MS,
        staleMs: STALE_MS,
        fallbackErrorMessage: FALLBACK,
      }),
    );

    await act(async () => {
      mock.timers.tick(DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    assert.equal(fetchCount, 1);
    assert.equal(result.current.isStale, false);

    await act(async () => {
      mock.timers.tick(STALE_MS);
    });
    assert.equal(result.current.isStale, true);

    let fresh: SampleQuote | null = null;
    await act(async () => {
      fresh = await result.current.freshQuote();
    });

    assert.equal(fetchCount, 2);
    assert.equal(fresh?.id, 2);
    assert.equal(result.current.quote?.id, 2);
    assert.equal(result.current.isStale, false);

    await unmount();
  } finally {
    mock.timers.reset();
  }
});

test('freshQuote skips debounce, aborts in-flight auto-quote, returns quote or null', async () => {
  const signals: AbortSignal[] = [];
  let fetchCount = 0;

  const fetchQuote = async (
    _request: SampleRequest,
    signal: AbortSignal,
  ): Promise<SampleQuote> => {
    fetchCount += 1;
    signals.push(signal);

    if (fetchCount === 1) {
      return await new Promise<SampleQuote>((_resolve, reject) => {
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

    return { id: 99, amount: '100' };
  };

  mock.timers.enable({
    apis: ['setTimeout', 'setInterval', 'Date'],
    now: 20_000,
  });

  try {
    const { result, unmount } = await renderHook(() =>
      useDebouncedAbortableQuote<SampleRequest, SampleQuote>({
        enabled: true,
        request: { amount: '100', term: 1 },
        requestKey: '100:1',
        fetchQuote,
        debounceMs: DEBOUNCE_MS,
        staleMs: STALE_MS,
        fallbackErrorMessage: FALLBACK,
      }),
    );

    await act(async () => {
      mock.timers.tick(DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
    });
    assert.equal(fetchCount, 1);

    let fresh: SampleQuote | null = null;
    await act(async () => {
      fresh = await result.current.freshQuote();
    });

    assert.equal(signals[0]?.aborted, true);
    assert.equal(fetchCount, 2);
    assert.equal(fresh?.id, 99);
    assert.equal(result.current.error, null);

    // freshQuote returns null when disabled / no request
    await act(async () => {
      result.current.invalidate();
    });

    await unmount();
  } finally {
    mock.timers.reset();
  }
});

test('invalidate aborts request, bumps request id, and resets state', async () => {
  const signals: AbortSignal[] = [];
  let releaseFetch: (() => void) | null = null;

  const fetchQuote = async (
    request: SampleRequest,
    signal: AbortSignal,
  ): Promise<SampleQuote> => {
    signals.push(signal);
    await new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    return { id: 1, amount: request.amount };
  };

  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 30_000 });

  try {
    const { result, unmount } = await renderHook(() =>
      useDebouncedAbortableQuote<SampleRequest, SampleQuote>({
        enabled: true,
        request: { amount: '100', term: 1 },
        requestKey: '100:1',
        fetchQuote,
        debounceMs: DEBOUNCE_MS,
        staleMs: STALE_MS,
        fallbackErrorMessage: FALLBACK,
      }),
    );

    await act(async () => {
      mock.timers.tick(DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
    });
    assert.equal(result.current.isLoading, true);
    assert.equal(signals.length, 1);

    await act(async () => {
      result.current.invalidate();
    });

    assert.equal(signals[0]?.aborted, true);
    assert.equal(result.current.quote, null);
    assert.equal(result.current.error, null);
    assert.equal(result.current.isLoading, false);
    assert.equal(result.current.quotedAtMs, null);
    assert.equal(result.current.isStale, false);

    // Late resolve after invalidate must not repopulate state.
    await act(async () => {
      releaseFetch?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    assert.equal(result.current.quote, null);
    assert.equal(result.current.isLoading, false);

    await unmount();
  } finally {
    mock.timers.reset();
  }
});

test('freshQuote uses latest request from ref (no stale closure)', async () => {
  const seen: SampleRequest[] = [];
  const fetchQuote = async (request: SampleRequest) => {
    seen.push(request);
    return { id: seen.length, amount: request.amount };
  };

  mock.timers.enable({
    apis: ['setTimeout', 'setInterval', 'Date'],
    now: 40_000,
  });

  try {
    let amount = '100';
    const { result, rerender, unmount } = await renderHook(() =>
      useDebouncedAbortableQuote<SampleRequest, SampleQuote>({
        enabled: true,
        request: { amount, term: 1 },
        requestKey: requestKey({ amount, term: 1 }),
        fetchQuote,
        debounceMs: DEBOUNCE_MS,
        staleMs: STALE_MS,
        fallbackErrorMessage: FALLBACK,
      }),
    );

    // Change amount during debounce window, then call freshQuote immediately.
    amount = '999';
    await act(async () => {
      rerender();
    });

    let fresh: SampleQuote | null = null;
    await act(async () => {
      fresh = await result.current.freshQuote();
    });

    assert.equal(fresh?.amount, '999');
    assert.deepEqual(seen[seen.length - 1], { amount: '999', term: 1 });

    await unmount();
  } finally {
    mock.timers.reset();
  }
});
