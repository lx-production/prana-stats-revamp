import { CACHE_TTL_MS } from '../constants/cachePolicy.js';
import { createBrowserJsonCache } from './browserJsonCache.ts';

export function getTopHoldingAddressesJsonUrl(force = false) {
  if (!force) return '/top_holding_addresses.json';
  return `/top_holding_addresses.json?t=${Date.now()}`;
}

const topHoldingAddressesJsonCache = createBrowserJsonCache({
  ttlMs: CACHE_TTL_MS.topHoldingAddressesJson,
  getUrl: getTopHoldingAddressesJsonUrl,
});

export async function fetchTopHoldingAddressesJsonSafe<T>(fallback: T, opts: { force?: boolean } = {}): Promise<T> {
  return await topHoldingAddressesJsonCache.fetchSafe(fallback, opts);
}

