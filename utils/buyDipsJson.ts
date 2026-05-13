import { BROWSER_CACHE_TTL_SECONDS } from '../constants/cachePolicy.ts';
import { createBrowserJsonCache } from './browserJsonCache';
import type { BuyDipsJson } from '../types/buyDips.types';

const buyDipsJsonCache = createBrowserJsonCache({
  ttlMs: BROWSER_CACHE_TTL_SECONDS.rootBuyDipsJsonHttp * 1000,
  getUrl: getBuyDipsJsonUrl,
});

export function getBuyDipsJsonUrl(force = false) {
  if (!force) return '/buy_dips.json';
  return `/buy_dips.json?t=${Date.now()}`;
}

export async function fetchBuyDipsJson<T>(opts: { force?: boolean } = {}): Promise<T> {
  return await buyDipsJsonCache.fetchCached<T>(opts);
}

export function getCachedBuyDipsJson(): BuyDipsJson | null {
  return buyDipsJsonCache.getCachedValue<BuyDipsJson>();
}
