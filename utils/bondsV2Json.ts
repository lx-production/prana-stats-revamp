import type { BondsV2Json } from '../types.ts';
import { CACHE_TTL_MS } from '../constants/cachePolicy.js';
import { createBrowserJsonCache } from './browserJsonCache.ts';

// Keep this small: the goal is to dedupe requests on page load,
// not to keep the bonds data stale for long periods.

// Default URL allows browser caching based on server cache headers.
// When `force` is true, append a one-off cache-buster to fetch the latest file.
export function getBondsV2JsonUrl(force = false) {
  if (!force) return '/bonds_v2.json';
  return `/bonds_v2.json?t=${Date.now()}`;
}

const bondsV2JsonCache = createBrowserJsonCache({
  ttlMs: CACHE_TTL_MS.bondsJson,
  getUrl: getBondsV2JsonUrl,
});

// Safe wrapper that keeps cache-busting + TTL logic private.
export async function fetchBondsV2JsonSafe<T>(fallback: T, opts: { force?: boolean } = {}): Promise<T> {
  return await bondsV2JsonCache.fetchSafe(fallback, opts);
}

export const getTotalsFromBondsV2Json = (data: unknown) => {
  const parsed = data as BondsV2Json | null | undefined;
  const buyPranaAmountStr = parsed?.buy?.pranaAmount;
  const sellPranaAmountStr = parsed?.sell?.pranaAmount;

  const buyBondTotalRawV2 =
    typeof buyPranaAmountStr === 'string' ? BigInt(buyPranaAmountStr) : 0n;
  const sellBondTotalRawV2 =
    typeof sellPranaAmountStr === 'string' ? BigInt(sellPranaAmountStr) : 0n;

  return { buyBondTotalRawV2, sellBondTotalRawV2 };
};

// Wrapper that uses fetchBondsV2JsonSafe + getTotalsFromBondsV2Json to return only the buy and sell bond totals
export async function fetchBondsV2TotalsSafe(
  opts: { force?: boolean } = {},
  data?: unknown
): Promise<{ buyBondTotalRawV2: bigint; sellBondTotalRawV2: bigint }> {
  const value = data ?? (await fetchBondsV2JsonSafe<unknown>(null, opts));
  return getTotalsFromBondsV2Json(value);
}
