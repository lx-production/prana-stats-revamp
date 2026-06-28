import { useCallback, useEffect, useState } from 'react';
import { SWAP_QUOTE_DEBOUNCE_MS } from '../constants/swapContracts';
import type {
  SwapQuoteErrorResponse,
  SwapQuoteResponse,
  UseUniswapQuoteInput,
  UseUniswapQuoteResult,
} from '../types/swap.types';

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

export function useUniswapQuote(input: UseUniswapQuoteInput): UseUniswapQuoteResult {
  const [quote, setQuote] = useState<SwapQuoteResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    const amount = Number(input.amountIn);

    if (!input.enabled || !input.recipient || !Number.isFinite(amount) || amount <= 0) {
      setQuote(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      setError(null);

      requestSwapQuote(input, abortController.signal)
        .then((nextQuote) => {
          setQuote(nextQuote);
        })
        .catch((err) => {
          if (abortController.signal.aborted) return;
          setQuote(null);
          setError(err instanceof Error ? err.message : 'Failed to load swap quote.');
        })
        .finally(() => {
          if (!abortController.signal.aborted) setIsLoading(false);
        });
    }, SWAP_QUOTE_DEBOUNCE_MS);

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
    refetch,
  };
}
