export const CACHE_TTL_MS = Object.freeze({
  apiResponse: 30_000,
  // /api/bond-metrics response snapshot TTL
  bondMetricsApiResponse: 86_400_000, // 24h
  // /api/staking-stats response snapshot TTL
  stakingStatsApiResponse: 86_400_000, // 24h
  lpTokenId: 86_400_000, // 24h
  topHoldingsRefresh: 30_000,
});

export const CACHE_TTL_SECONDS = Object.freeze({
  apiResponseBrowserHttp: 30,
  // /api/bond-metrics HTTP cache TTL (Cache-Control: private, max-age=...)
  bondMetricsApiResponseBrowserHttp: 60 * 60 * 24, // 24h
  // /api/staking-stats HTTP cache TTL (Cache-Control: private, max-age=...)
  stakingStatsApiResponseBrowserHttp: 60 * 60 * 24, // 24h
  rootBondsJsonHttp: 30,
  rootBuyDipsJsonHttp: 30,
  rootDataJsonHttp: 30,
  staticAssetsHttp: 60 * 60 * 24 * 365,
});
