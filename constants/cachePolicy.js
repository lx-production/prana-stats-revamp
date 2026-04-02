export const CACHE_TTL_MS = Object.freeze({
  apiResponse: 30_000,
  bondsRefresh: 30_000,
  lpTokenId: 86_400_000, // 24h
  topHoldingsRefresh: 30_000,
});

export const CACHE_TTL_SECONDS = Object.freeze({
  apiResponseBrowserHttp: 30,
  rootBondsJsonHttp: 30,
  rootBuyDipsJsonHttp: 30,
  rootDataJsonHttp: 30,
  staticAssetsHttp: 60 * 60 * 24 * 365,
});
