import { fetchStakingQuote } from '../stakingApi.ts';
import { useDebouncedAbortableQuote } from '../../../hooks/useDebouncedAbortableQuote.ts';

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
 * Stable request key — amount + duration only.
 * New object identity with the same data must not re-trigger a fetch.
 */
export function stakingQuoteRequestKey(
  request: StakingQuoteRequest | null,
): readonly [string, number] | '' {
  if (!request) return '';
  return [request.amountRaw, request.durationSeconds] as const;
}

/**
 * Live staking fund quote: thin wrapper over the shared debounced/abortable
 * quote lifecycle. CTA uses `freshQuote()` instead of a refresh button.
 */
export function useStakingQuote(
  input: UseStakingQuoteInput,
): UseStakingQuoteResult {
  return useDebouncedAbortableQuote<StakingQuoteRequest, StakingQuote>({
    enabled: input.enabled,
    request: input.request,
    requestKey: stakingQuoteRequestKey(input.request),
    fetchQuote: fetchStakingQuote,
    debounceMs: STAKING_QUOTE_DEBOUNCE_MS,
    staleMs: STAKING_QUOTE_STALE_MS,
    fallbackErrorMessage: 'Failed to load staking quote.',
  });
}
