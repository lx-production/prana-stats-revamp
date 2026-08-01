import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  DebouncedAbortableQuoteRequestKey,
  UseDebouncedAbortableQuoteInput,
  UseDebouncedAbortableQuoteResult,
} from '../types/debouncedAbortableQuote.types.ts';

/**
 * Normalize a string or readonly primitive tuple into one stable string so the
 * effect can depend on a single primitive (no lint-ignored dependency arrays).
 */
export function normalizeDebouncedAbortableQuoteRequestKey(
  requestKey: DebouncedAbortableQuoteRequestKey,
): string {
  if (typeof requestKey === 'string') return requestKey;
  return requestKey.map((part) => String(part ?? '')).join('\0');
}

/**
 * Shared quote lifecycle: debounce, AbortController, monotonic request id,
 * clear-on-input-change, loading only after debounce, stale tick, freshQuote,
 * and invalidate. Feature wrappers supply request key, fetcher, and messages.
 */
export function useDebouncedAbortableQuote<TRequest, TQuote>({
  enabled,
  request,
  requestKey,
  fetchQuote,
  debounceMs,
  staleMs,
  fallbackErrorMessage,
}: UseDebouncedAbortableQuoteInput<TRequest, TQuote>): UseDebouncedAbortableQuoteResult<TQuote> {
  const [quote, setQuote] = useState<TQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotedAtMs, setQuotedAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Monotonic request id so out-of-order responses never overwrite newer quotes.
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Keep latest inputs for freshQuote / in-flight safety (avoid stale closures).
  const enabledRef = useRef(enabled);
  const requestRef = useRef(request);
  const fetchQuoteRef = useRef(fetchQuote);
  const fallbackErrorMessageRef = useRef(fallbackErrorMessage);
  enabledRef.current = enabled;
  requestRef.current = request;
  fetchQuoteRef.current = fetchQuote;
  fallbackErrorMessageRef.current = fallbackErrorMessage;

  // Effect depends on this primitive only — not request object identity.
  const normalizedRequestKey =
    normalizeDebouncedAbortableQuoteRequestKey(requestKey);

  const invalidate = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    requestIdRef.current += 1;
    setQuote(null);
    setIsLoading(false);
    setError(null);
    setQuotedAtMs(null);
  }, []);

  // Tick once per second while a quote is showing so `isStale` flips at staleMs.
  useEffect(() => {
    if (quotedAtMs == null) return;
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);
    return () => window.clearInterval(intervalId);
  }, [quotedAtMs]);

  const isStale = quotedAtMs != null && nowMs - quotedAtMs >= staleMs;

  // Debounced auto-quote when the stable request key (or enabled) changes.
  useEffect(() => {
    // Read request from the ref so object identity is not an effect dependency.
    const currentRequest = requestRef.current;

    // Inline clear — do not call `invalidate` here (avoids re-entry / extra runs).
    if (!enabled || currentRequest == null) {
      abortRef.current?.abort();
      abortRef.current = null;
      requestIdRef.current += 1;
      setQuote(null);
      setIsLoading(false);
      setError(null);
      setQuotedAtMs(null);
      return;
    }

    const abortController = new AbortController();
    abortRef.current?.abort();
    abortRef.current = abortController;

    const requestId = ++requestIdRef.current;
    // Capture at schedule time; key equality means data did not change.
    const scheduledRequest = currentRequest;

    // Drop the previous quote as soon as inputs change, but do NOT set loading
    // yet — wait until the debounce timer fires.
    setQuote(null);
    setQuotedAtMs(null);
    setError(null);
    setIsLoading(false);

    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      fetchQuoteRef
        .current(scheduledRequest, abortController.signal)
        .then((nextQuote) => {
          if (abortController.signal.aborted) return;
          if (requestId !== requestIdRef.current) return;
          setQuote(nextQuote);
          setQuotedAtMs(Date.now());
          setNowMs(Date.now());
        })
        .catch((err) => {
          if (abortController.signal.aborted) return;
          if (requestId !== requestIdRef.current) return;
          setQuote(null);
          setQuotedAtMs(null);
          setError(
            err instanceof Error ? err.message : fallbackErrorMessageRef.current,
          );
        })
        .finally(() => {
          if (
            !abortController.signal.aborted &&
            requestId === requestIdRef.current
          ) {
            setIsLoading(false);
          }
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [enabled, normalizedRequestKey, debounceMs]);

  const freshQuote = useCallback(async (): Promise<TQuote | null> => {
    const currentEnabled = enabledRef.current;
    const currentRequest = requestRef.current;
    if (!currentEnabled || currentRequest == null) return null;

    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;
    const requestId = ++requestIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const nextQuote = await fetchQuoteRef.current(
        currentRequest,
        abortController.signal,
      );
      if (abortController.signal.aborted) return null;
      if (requestId !== requestIdRef.current) return null;
      setQuote(nextQuote);
      setQuotedAtMs(Date.now());
      setNowMs(Date.now());
      return nextQuote;
    } catch (err) {
      if (abortController.signal.aborted) return null;
      if (requestId !== requestIdRef.current) return null;
      setQuote(null);
      setQuotedAtMs(null);
      setError(
        err instanceof Error ? err.message : fallbackErrorMessageRef.current,
      );
      return null;
    } finally {
      if (
        !abortController.signal.aborted &&
        requestId === requestIdRef.current
      ) {
        setIsLoading(false);
      }
    }
  }, []);

  return {
    quote,
    isLoading,
    error,
    isStale,
    quotedAtMs,
    freshQuote,
    invalidate,
  };
}
