import { useCallback, useEffect, useState } from 'react';
import { SWAP_QUOTE_DEBOUNCE_MS, SWAP_QUOTE_MANUAL_REFRESH_COOLDOWN_MS } from '../constants/swapContracts';

import type { SwapQuoteErrorResponse, SwapQuoteResponse, UseUniswapQuoteInput, UseUniswapQuoteResult } from '../types/swap.types';

/**
 * Calls our backend `/api/swap/quote` endpoint.
 * The server talks to Uniswap and returns a priced quote for the given swap inputs.
 * `signal` lets us cancel an in-flight request when inputs change (AbortController).
 */
async function requestSwapQuote(input: UseUniswapQuoteInput, signal: AbortSignal): Promise<SwapQuoteResponse> {
  const response = await fetch('/api/swap/quote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tokenInSymbol: input.tokenInSymbol,
      tokenOutSymbol: input.tokenOutSymbol,
      amountIn: input.amountIn,
      recipient: input.recipient,
      slippageBps: input.slippageBps,
    }),
    signal,
  });

  const contentType = response.headers.get('content-type') ?? '';

  // Dev servers sometimes return HTML error pages instead of JSON
  // (e.g. route missing / server not restarted). Fail with a clear message.
  if (!contentType.includes('application/json')) {
    throw new Error('Swap quote backend is not available. Please restart the app server and try again.');
  }

  const json = (await response.json()) as SwapQuoteResponse | SwapQuoteErrorResponse;

  if (!response.ok) {
    const errorBody = json as SwapQuoteErrorResponse;
    throw new Error(errorBody.message || 'Failed to load swap quote.');
  }

  return json as SwapQuoteResponse;
}

/**
 * Fetches a live Uniswap swap quote as the user edits the swap form.
 *
 * Behavior overview:
 * - Debounces typing so we don't spam the API on every keystroke
 * - Aborts the previous request when inputs change
 * - Supports a manual `refetch()` with a short cooldown (UI countdown)
 */
export function useUniswapQuote(input: UseUniswapQuoteInput): UseUniswapQuoteResult {
  const [quote, setQuote] = useState<SwapQuoteResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bumping this key re-runs the quote effect without changing swap inputs.
  // Used by the manual refresh button.
  const [refreshKey, setRefreshKey] = useState(0);

  // Timestamp (ms) until which manual refresh is blocked.
  const [manualRefreshCooldownUntil, setManualRefreshCooldownUntil] = useState(0);

  // "Current time" tick used to drive the cooldown countdown in the UI.
  // We update it every second while a cooldown is active.
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Derived cooldown values for the refresh button UI.
  const refreshCooldownMs = Math.max(0, manualRefreshCooldownUntil - nowMs);
  const isRefreshCoolingDown = refreshCooldownMs > 0;
  const refreshCooldownSeconds = Math.ceil(refreshCooldownMs / 1000);

  // Manual refresh: only works when we have a valid amount + wallet,
  // and only after the cooldown has expired.
  const refetch = useCallback(() => {
    const amount = Number(input.amountIn);

    if (!input.enabled || !input.recipient || !Number.isFinite(amount) || amount <= 0) return;

    const now = Date.now();

    // Still in cooldown — ignore the click.
    if (manualRefreshCooldownUntil > now) return;

    setNowMs(now);
    setManualRefreshCooldownUntil(now + SWAP_QUOTE_MANUAL_REFRESH_COOLDOWN_MS);
    // Trigger a fresh quote fetch via the effect below.
    setRefreshKey((current) => current + 1);
  }, [input.amountIn, input.enabled, input.recipient, manualRefreshCooldownUntil]);

  // While cooldown is active, tick `nowMs` every second so the UI countdown updates.
  // Also clear the cooldown state exactly when it expires.
  useEffect(() => {
    if (manualRefreshCooldownUntil <= Date.now()) return;

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    const timeoutId = window.setTimeout(() => {
      setNowMs(Date.now());
      setManualRefreshCooldownUntil(0);
    }, manualRefreshCooldownUntil - Date.now());

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [manualRefreshCooldownUntil]);

  // Main quote-fetching effect.
  // Runs when swap inputs change, or when `refreshKey` is bumped by refetch().
  useEffect(() => {
    const amount = Number(input.amountIn);

    // Not ready to quote yet (empty amount, no wallet, hook disabled, etc.).
    // Clear any stale quote/error so the UI shows an empty state.
    if (!input.enabled || !input.recipient || !Number.isFinite(amount) || amount <= 0) {
      setQuote(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // AbortController cancels the previous fetch if the user changes inputs
    // before the current request finishes.
    const abortController = new AbortController();
    setQuote(null);
    setIsLoading(true);
    setError(null);

    // Debounce: wait until the user pauses typing before hitting the API.
    const timeoutId = window.setTimeout(() => {
      requestSwapQuote(input, abortController.signal)
        .then((nextQuote) => {
          setQuote(nextQuote);
        })
        .catch((err) => {
          // Ignore errors from requests we intentionally cancelled.
          if (abortController.signal.aborted) return;
          setQuote(null);
          setError(err instanceof Error ? err.message : 'Failed to load swap quote.');
        })
        .finally(() => {
          if (!abortController.signal.aborted) setIsLoading(false);
        });
    }, SWAP_QUOTE_DEBOUNCE_MS);

    // Cleanup: cancel the debounce timer AND abort any in-flight request
    // when inputs change or the component unmounts.
    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [
    input.amountIn,
    input.enabled,
    input.recipient,
    input.slippageBps,
    input.tokenInSymbol,
    input.tokenOutSymbol,
    refreshKey,
  ]);

  return {
    quote,
    isLoading,
    error,
    isRefreshCoolingDown,
    refreshCooldownSeconds,
    refetch,
  };
}
