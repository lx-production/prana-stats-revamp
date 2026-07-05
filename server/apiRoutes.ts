import { SERVER_CACHE_TTL_MS, BROWSER_CACHE_TTL_SECONDS } from '../constants/cachePolicy.ts';
import type { SwapQuoteRequest } from '../types/swap.types.ts';
import { createServerCache } from './cacheHelpers.ts';
import { loadCachedBondMetrics } from './loaders/bondMetricsCached.ts';
import { loadCachedCapital } from './loaders/capitalCached.ts';
import { loadCachedLpCapital } from './loaders/lpCapitalCached.ts';
import { loadPranaStats } from './loaders/pranaStats.ts';
import { loadCachedStakingStats } from './loaders/stakingStatsCached.ts';
import { loadSummaryMarkdown } from './loaders/summary.ts';
import { loadSwapQuote } from './loaders/swapQuote.ts';
import { logSwapTransactionEvent, parseSwapTransactionLogRequest } from './loaders/swapLogs.ts';
import { loadCachedTopHoldingAddresses } from './loaders/topHoldingAddresses.ts';
import type { SwapRateLimiters } from './rateLimit.ts';
import { readJsonBody, sendJson, sendText } from './requestHelpers.ts';
import type { RequestHandler } from './types/httpTypes.ts';

const READONLY_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.apiResponseBrowserHttp}`;
const READONLY_LP_CAPITAL_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.lpCapitalApiResponseBrowserHttp}`;
const READONLY_STAKING_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.stakingStatsApiResponseBrowserHttp}`;
const READONLY_BOND_METRICS_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.bondMetricsApiResponseBrowserHttp}`;
const SWAP_QUOTE_BODY_MAX_BYTES = 2048;
const SWAP_LOG_BODY_MAX_BYTES = 8192;

export const pranaStatsCache = createServerCache(SERVER_CACHE_TTL_MS.apiResponse);
export const summaryCache = createServerCache<string>(SERVER_CACHE_TTL_MS.summaryApiResponse);

function sanitizeSwapErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  const allowedMessages = [
    'Choose two different tokens.',
    'Connect a valid wallet address.',
    'Enter an amount greater than zero.',
    'No Uniswap route found for this pair or amount.',
    'Request body is required.',
    'Request body is too large.',
  ];

  if (allowedMessages.includes(error.message)) return error.message;
  if (error instanceof SyntaxError) return 'Invalid JSON request body.';
  return fallback;
}

export function createApiRouteHandler(rateLimiters: SwapRateLimiters): RequestHandler {
  return async function handleApiRequest(req, res, url): Promise<boolean> {
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

    if (url.pathname === '/api/swap/quote') {
      if (req.method !== 'POST') {
        sendJson(res, 405, {
          error: 'method_not_allowed',
          message: 'Use POST for swap quotes.',
        });
        return true;
      }

      if (rateLimiters.isSwapQuoteRateLimited(req)) {
        sendJson(res, 429, {
          error: 'rate_limited',
          message: 'Too many swap quote requests. Please wait a moment and try again.',
        });
        return true;
      }

      try {
        const body = await readJsonBody<SwapQuoteRequest>(req, SWAP_QUOTE_BODY_MAX_BYTES);
        const result = await loadSwapQuote(body);
        sendJson(res, 200, result);
        return true;
      } catch (err) {
        sendJson(res, 400, {
          error: 'quote_failed',
          message: sanitizeSwapErrorMessage(err, 'Failed to load swap quote.'),
        });
        return true;
      }
    }

    if (url.pathname === '/api/swap/log') {
      if (req.method !== 'POST') {
        sendJson(res, 405, {
          error: 'method_not_allowed',
          message: 'Use POST for swap logs.',
        });
        return true;
      }

      if (rateLimiters.isSwapLogRateLimited(req)) {
        sendJson(res, 429, {
          error: 'rate_limited',
          message: 'Too many swap log requests.',
        });
        return true;
      }

      try {
        const body = await readJsonBody<unknown>(req, SWAP_LOG_BODY_MAX_BYTES);
        const payload = parseSwapTransactionLogRequest(body);
        logSwapTransactionEvent(payload);
        sendJson(res, 200, { ok: true });
        return true;
      } catch (err) {
        sendJson(res, 400, {
          error: 'log_failed',
          message: sanitizeSwapErrorMessage(err, 'Failed to write swap log.'),
        });
        return true;
      }
    }

    return false;
  };
}
