import { fetchJson } from './fetchJson';
import type { BondsV2Json } from '../types';

// Keep this small: the goal is to dedupe requests on page load,
// not to keep the bonds data stale for long periods.
const BONDS_V2_JSON_TTL_MS = 60_000; // 1 minute

let cached: { value: unknown; timestamp: number } | null = null;

// Default URL allows browser caching based on server cache headers.
// When `force` is true, append a one-off cache-buster to fetch the latest file.
export function getBondsV2JsonUrl(force = false) {
  if (!force) return '/bonds_v2.json';
  return `/bonds_v2.json?t=${Date.now()}`;
}

async function fetchBondsV2JsonCached<T = unknown>(opts: { force?: boolean } = {}): Promise<T> {
  const force = opts.force === true;
  const now = Date.now();

  // If cached data exists and is less than 1 minute old, return it
  if (!force && cached && now - cached.timestamp < BONDS_V2_JSON_TTL_MS) {
    return cached.value as T;
  }

  const value = await fetchJson<T>(getBondsV2JsonUrl(force), undefined, {
    dedupeKey: force ? null : undefined,
  });
  cached = { value, timestamp: Date.now() };
  return value;
}

// Safe wrapper that keeps cache-busting + TTL logic private.
export async function fetchBondsV2JsonSafe<T>(fallback: T, opts: { force?: boolean } = {}): Promise<T> {
  try {
    return await fetchBondsV2JsonCached<T>(opts);
  } catch (e) {
    console.warn('Failed to fetch bonds_v2.json', e);
    return fallback;
  }
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
