import { fetchBondingQuote } from '../utils/bondingApi.ts';
import { useDebouncedAbortableQuote } from '../../../hooks/useDebouncedAbortableQuote.ts';

import type { BondingQuote, BondingQuoteRequest, BondTermId } from '../bonding.types.ts';

/** Debounce typing before hitting POST /api/bonding/quote. */
export const BONDING_QUOTE_DEBOUNCE_MS = 1000;

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

/**
 * Stable request key — mode + amount + term.
 * Side changes map to mode via `buildBondingQuoteRequest`.
 * New object identity with the same data must not re-trigger a fetch.
 */
export function bondingQuoteRequestKey(
  request: BondingQuoteRequest | null,
): readonly [string, string, number] | '' {
  if (!request) return '';
  return [request.mode, request.amountRaw, request.termId] as const;
}

/**
 * Live bonding quote: thin wrapper over the shared debounced/abortable quote
 * lifecycle. CTA uses `freshQuote()` instead of a manual refresh button.
 */
export function useBondingQuote(
  input: UseBondingQuoteInput,
): UseBondingQuoteResult {
  return useDebouncedAbortableQuote<BondingQuoteRequest, BondingQuote>({
    enabled: input.enabled,
    request: input.request,
    requestKey: bondingQuoteRequestKey(input.request),
    fetchQuote: fetchBondingQuote,
    debounceMs: BONDING_QUOTE_DEBOUNCE_MS,
    staleMs: BONDING_QUOTE_STALE_MS,
    fallbackErrorMessage: 'Failed to load bonding quote.',
  });
}
