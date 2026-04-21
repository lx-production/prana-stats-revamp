import type { BondsV2Json } from '../types/types.ts';
import { fetchJsonSafe } from './fetchJson.ts';

// Default URL allows browser caching based on server cache headers.
// When `force` is true, append a one-off cache-buster to fetch the latest file.
export function getBondsV2JsonUrl(force = false) {
  if (!force) return '/bonds_v2.json';
  return `/bonds_v2.json?t=${Date.now()}`;
}

export async function fetchBondsV2JsonSafe<T>(fallback: T, opts: { force?: boolean } = {}): Promise<T> {
  return await fetchJsonSafe<T>(getBondsV2JsonUrl(opts.force === true), fallback);
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
