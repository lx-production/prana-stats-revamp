import { fetchJsonSafe } from './fetchJson.ts';

import type { BondsV2Json } from '../types/types.ts';

// URL allows browser caching based on server cache headers.
export function getBondsV2JsonUrl() {
  return '/bonds_v2.json';
}

export async function fetchBondsV2JsonSafe<T>(fallback: T): Promise<T> {
  return await fetchJsonSafe<T>(getBondsV2JsonUrl(), fallback);
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
  data?: unknown
): Promise<{ buyBondTotalRawV2: bigint; sellBondTotalRawV2: bigint }> {
  const value = data ?? (await fetchBondsV2JsonSafe<unknown>(null));
  return getTotalsFromBondsV2Json(value);
}
