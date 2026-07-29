import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchStakingQuote } from '../stakingApi.ts';

import type { StakingQuote, StakingQuoteRequest } from '../staking.types.ts';

/** Debounce typing before hitting POST /api/staking/quote. */
export const STAKING_QUOTE_DEBOUNCE_MS = 1000;

/** After this age, the UI marks the quote stale; CTA must fresh-quote. */
export const STAKING_QUOTE_STALE_MS = 60_000;

export type UseStakingQuoteInput = {
  enabled: boolean;
  request: StakingQuoteRequest | null;
};

export type UseStakingQuoteResult = {
  quote: StakingQuote | null;
  isLoading: boolean;
  error: string | null;
  /** True when a successful quote is older than STAKING_QUOTE_STALE_MS. */
  isStale: boolean;
  /** Epoch ms when the current quote was received (null if none). */
  quotedAtMs: number | null;
  /**
   * Immediate (non-debounced) quote refresh for CTA preflight.
   * Returns the fresh quote, or null on abort/failure.
   */
  freshQuote: () => Promise<StakingQuote | null>;
  /** Clear quote/error state. */
  invalidate: () => void;
};

/**
 * Build a quote request when amount + duration are ready.
 * Returns null while the form is still incomplete.
 */
export function buildStakingQuoteRequest(input: {
  amountRaw: bigint | null;
  durationSeconds: number | null;
}): StakingQuoteRequest | null {
  if (input.amountRaw == null || input.amountRaw <= 0n) return null;
  if (input.durationSeconds == null || input.durationSeconds <= 0) return null;
  return {
    amountRaw: input.amountRaw.toString(),
    durationSeconds: input.durationSeconds,
  };
}

/**
 * Live staking fund quote with 1s debounce, AbortController cancel, stale drop,
 * and a 60s stale mark. CTA uses `freshQuote()` instead of a refresh button.
 *
 * `isLoading` flips only when the debounced fetch starts — not on every keystroke.
 */
export function useStakingQuote(
  input: UseStakingQuoteInput,
): UseStakingQuoteResult {
  const [quote, setQuote] = useState<StakingQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotedAtMs, setQuotedAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Monotonic request id so out-of-order responses never overwrite newer quotes.
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Keep the latest request for freshQuote without re-creating the callback.
  const inputRef = useRef(input);
  inputRef.current = input;

  const invalidate = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    requestIdRef.current += 1;
    setQuote(null);
    setIsLoading(false);
    setError(null);
    setQuotedAtMs(null);
  }, []);

  // Tick once per second while a quote is showing so `isStale` flips at 60s.
  useEffect(() => {
    if (quotedAtMs == null) return;
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);
    return () => window.clearInterval(intervalId);
  }, [quotedAtMs]);

  const isStale =
    quotedAtMs != null && nowMs - quotedAtMs >= STAKING_QUOTE_STALE_MS;

  // Debounced auto-quote when request inputs change.
  useEffect(() => {
    if (!input.enabled || !input.request) {
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
    const request = input.request;

    // Drop the previous quote as soon as inputs change, but do NOT set loading
    // yet — wait until the debounce timer fires.
    setQuote(null);
    setQuotedAtMs(null);
    setError(null);
    setIsLoading(false);

    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      fetchStakingQuote(request, abortController.signal)
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
            err instanceof Error ? err.message : 'Failed to load staking quote.',
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
    }, STAKING_QUOTE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [
    input.enabled,
    input.request?.amountRaw,
    input.request?.durationSeconds,
  ]);

  const freshQuote = useCallback(async (): Promise<StakingQuote | null> => {
    const current = inputRef.current;
    if (!current.enabled || !current.request) return null;

    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;
    const requestId = ++requestIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const nextQuote = await fetchStakingQuote(
        current.request,
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
        err instanceof Error ? err.message : 'Failed to load staking quote.',
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
