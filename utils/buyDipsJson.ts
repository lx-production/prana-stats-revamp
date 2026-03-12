import { CACHE_TTL_MS } from '../constants/cachePolicy.js';
import { createBrowserJsonCache } from './browserJsonCache.ts';

export function getBuyDipsJsonUrl(force = false) {
  if (!force) return '/buy_dips.json';
  return `/buy_dips.json?t=${Date.now()}`;
}

const buyDipsJsonCache = createBrowserJsonCache({
  ttlMs: CACHE_TTL_MS.buyDipsJson,
  getUrl: getBuyDipsJsonUrl,
});

export async function fetchBuyDipsJson<T>(opts: { force?: boolean } = {}): Promise<T> {
  return await buyDipsJsonCache.fetchCached<T>(opts);
}

export async function fetchBuyDipsJsonSafe<T>(fallback: T, opts: { force?: boolean } = {}): Promise<T> {
  return await buyDipsJsonCache.fetchSafe(fallback, opts);
}
