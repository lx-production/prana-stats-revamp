import { createServerCache } from './helpers/cacheHelpers.ts';
import { loadPranaStats } from './loaders/pranaStats.ts';
import { loadSummaryMarkdown } from './loaders/summary.ts';
import { sendJson, sendText } from './helpers/requestHelpers.ts';
import { loadCachedCapital } from './loaders/cached/capitalCached.ts';
import { loadCachedLpCapital } from './loaders/cached/lpCapitalCached.ts';
import { loadCachedBondMetrics } from './loaders/cached/bondMetricsCached.ts';
import { loadCachedStakingStats } from './loaders/cached/stakingStatsCached.ts';
import { loadCachedTopHoldingAddresses } from './loaders/topHoldingAddresses.ts';
import { BROWSER_CACHE_TTL_SECONDS, SERVER_CACHE_TTL_MS } from '../constants/cachePolicy.ts';

import type { RequestHandler } from './types/httpTypes.ts';

// Browser Cache-Control values for readonly GET responses
const READONLY_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.apiResponseBrowserHttp}`;
const READONLY_LP_CAPITAL_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.lpCapitalApiResponseBrowserHttp}`;
const READONLY_STAKING_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.stakingStatsApiResponseBrowserHttp}`;
const READONLY_BOND_METRICS_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.bondMetricsApiResponseBrowserHttp}`;

// In-memory server caches shared with startup warmup
export const pranaStatsCache = createServerCache(SERVER_CACHE_TTL_MS.apiResponse);
export const summaryCache = createServerCache<string>(SERVER_CACHE_TTL_MS.summaryApiResponse);

// Handles readonly GET API routes (stats, capital, summary, etc.)
export function createGetApiRouteHandler(): RequestHandler {
  return async function handleGetApiRequest(req, res, url): Promise<boolean> {
    if (url.pathname === '/api/summary') {
      const result = await summaryCache(() => loadSummaryMarkdown());
      sendText(res, 200, result, {
        cacheControl: READONLY_API_CACHE_CONTROL,
        contentType: 'text/markdown; charset=utf-8',
      });
      return true;
    }

    // Endpoint the frontend can call for top holdings with a short-lived memory cache.
    if (url.pathname === '/api/top-holding-addresses') {
      const result = await loadCachedTopHoldingAddresses();
      sendJson(res, 200, result, { cacheControl: READONLY_API_CACHE_CONTROL });
      return true;
    }

    if (url.pathname === '/api/prana-stats') {
      const result = await pranaStatsCache(loadPranaStats);
      sendJson(res, 200, result, { cacheControl: READONLY_API_CACHE_CONTROL });
      return true;
    }

    if (url.pathname === '/api/staking-stats') {
      const result = await loadCachedStakingStats();
      sendJson(res, 200, result, { cacheControl: READONLY_STAKING_API_CACHE_CONTROL });
      return true;
    }

    if (url.pathname === '/api/capital') {
      const result = await loadCachedCapital();
      sendJson(res, 200, result, { cacheControl: READONLY_API_CACHE_CONTROL });
      return true;
    }

    if (url.pathname === '/api/lp-capital') {
      const result = await loadCachedLpCapital();
      sendJson(res, 200, result, { cacheControl: READONLY_LP_CAPITAL_API_CACHE_CONTROL });
      return true;
    }

    if (url.pathname === '/api/bond-metrics') {
      const result = await loadCachedBondMetrics();
      sendJson(res, 200, result, { cacheControl: READONLY_BOND_METRICS_API_CACHE_CONTROL });
      return true;
    }

    // Not a GET API route — let the next handler try
    return false;
  };
}
