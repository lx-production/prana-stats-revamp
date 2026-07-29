import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchBondingQuote } from '../bondingApi.ts';

import type {
  BondingQuote,
  BondingQuoteRequest,
  BondTermId,
} from '../bonding.types.ts';

/** Debounce typing before hitting POST /api/bonding/quote. */
export const BONDING_QUOTE_DEBOUNCE_MS = 600;

/** After this age, the UI marks the quote stale and CTA must fresh-quote. */
export const BONDING_QUOTE_STALE_MS = 60_000;

export type UseBondingQuoteInput = {
  enabled: boolean;
  request: BondingQuoteRequest | null;
};

export type UseBondingQuoteResult = {
  quote: BondingQuote | null;
  isLoading: boolean;
  error: string | null;
  /** True when a successful quote is older than BONDING_QUOTE_STALE_MS. */
  isStale: boolean;
  /** Epoch ms when the current quote was received (null if none). */
  quotedAtMs: number | null;
  /**
   * Immediate (non-debounced) quote refresh for CTA preflight.
   * Returns the fresh quote, or null on abort/failure.
   */
  freshQuote: () => Promise<BondingQuote | null>;
  /** Clear quote/error state (e.g. side/mode toggle). */
  invalidate: () => void;
};

/**
 * Live bonding quote with 600ms debounce, AbortController cancel, stale drop,
 * and a 60s stale mark. CTA uses `freshQuote()` instead of a manual refresh button.
 *
 * Important: `isLoading` flips only when the debounced fetch actually starts —
 * not on every keystroke — so typing does not look like an instant quote call.
 */
export function useBondingQuote(
  input: UseBondingQuoteInput,
): UseBondingQuoteResult {
  const [quote, setQuote] = useState<BondingQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotedAtMs, setQuotedAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Monotonic request id so out-of-order responses never overwrite newer quotes.
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Keep the latest request for freshQuote without re-creating the callback
  // on every keystroke identity change mid-flight.
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
    quotedAtMs != null && nowMs - quotedAtMs >= BONDING_QUOTE_STALE_MS;

  // Debounced auto-quote when request inputs change.
  useEffect(() => {
    if (!input.enabled || !input.request) {
      // Inline clear — do not depend on `invalidate` in this effect's deps
      // (avoids re-entry / extra runs when the disabled branch clears state).
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

    // Drop the previous quote as soon as inputs change (mirror Swap), but do
    // NOT set loading yet — wait until the debounce timer fires.
    setQuote(null);
    setQuotedAtMs(null);
    setError(null);
    setIsLoading(false);

    const timeoutId = window.setTimeout(() => {
      // Debounce settled — now the network work (and loading UI) starts.
      setIsLoading(true);
      fetchBondingQuote(request, abortController.signal)
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
            err instanceof Error ? err.message : 'Failed to load bonding quote.',
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
    }, BONDING_QUOTE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [
    input.enabled,
    input.request?.mode,
    input.request?.amountRaw,
    input.request?.termId,
  ]);

  const freshQuote = useCallback(async (): Promise<BondingQuote | null> => {
    const current = inputRef.current;
    if (!current.enabled || !current.request) return null;

    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;
    const requestId = ++requestIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const nextQuote = await fetchBondingQuote(
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
        err instanceof Error ? err.message : 'Failed to load bonding quote.',
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

/** Build a typed quote request from form state (null when incomplete). */
export function buildBondingQuoteRequest(args: {
  side: 'buy' | 'sell';
  amountRaw: bigint | null;
  termId: BondTermId | null;
}): BondingQuoteRequest | null {
  if (args.amountRaw == null || args.termId == null) return null;
  const amountRaw = args.amountRaw.toString();
  const termId = args.termId;

  if (args.side === 'sell') {
    return { mode: 'sell_exact_prana', amountRaw, termId };
  }
  return { mode: 'buy_exact_wbtc', amountRaw, termId };
}
