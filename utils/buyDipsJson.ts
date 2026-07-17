import { BROWSER_CACHE_TTL_SECONDS } from '../constants/cachePolicy.ts';
import { createBrowserJsonCache } from './browserJsonCache';

import type { BuyDipsJson } from '../types/buyDips.types';

export function getBuyDipsJsonUrl() {
  return '/buy_dips.json';
}

const buyDipsJsonCache = createBrowserJsonCache({
  ttlMs: BROWSER_CACHE_TTL_SECONDS.rootBuyDipsJsonHttp * 1000,
  getUrl: getBuyDipsJsonUrl,
});

export async function fetchBuyDipsJson<T>(): Promise<T> {
  return await buyDipsJsonCache.fetchCached<T>();
}

export function getCachedBuyDipsJson(): BuyDipsJson | null {
  return buyDipsJsonCache.getCachedValue<BuyDipsJson>();
}
