import { createServerCache } from './helpers/cacheHelpers.ts';
import { loadVersionInfo } from './loaders/version.ts';
import { loadPranaStats } from './loaders/pranaStats.ts';
import { loadSummaryMarkdown } from './loaders/summary.ts';
import { formatErrorForLog } from './helpers/logRedaction.ts';
import { sendJson, sendText } from './helpers/requestHelpers.ts';
import { loadStakingAccount } from './loaders/stakingAccount.ts';
import { parseChecksumAddress } from './helpers/addressHelpers.ts';
import { loadCachedCapital } from './loaders/cached/capitalCached.ts';
import { loadCachedLpCapital } from './loaders/cached/lpCapitalCached.ts';
import { loadCachedBondMetrics } from './loaders/cached/bondMetricsCached.ts';
import { loadCachedStakingStats } from './loaders/cached/stakingStatsCached.ts';
import { loadCachedStakingConfig } from './loaders/cached/stakingConfigCached.ts';
import { loadCachedTopHoldingAddresses, TOP_HOLDERS_PAGE_SIZE } from './loaders/topHoldingAddresses.ts';
import { TOP_HOLDING_ADDRESSES } from '../constants/topHoldingAddresses.ts';
import { BROWSER_CACHE_TTL_SECONDS, SERVER_CACHE_TTL_MS } from '../constants/cachePolicy.ts';

import type { Address } from '../types/blockchain.types.ts';
import type { RequestHandler } from './types/httpTypes.ts';
import type { SwapRateLimiters } from './rateLimit.ts';
import type { StakingAccountSnapshot, StakingConfig } from '../features/staking/staking.types.ts';

// Browser Cache-Control values for readonly GET responses
const READONLY_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.apiResponseBrowserHttp}`;
const READONLY_LP_CAPITAL_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.lpCapitalApiResponseBrowserHttp}`;
const READONLY_STAKING_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.stakingStatsApiResponseBrowserHttp}`;
const READONLY_STAKING_CONFIG_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.apiResponseBrowserHttp}`;
const READONLY_BOND_METRICS_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.bondMetricsApiResponseBrowserHttp}`;
const STAKING_ACCOUNT_CACHE_CONTROL = 'private, no-store';
// Version identity is fixed for the process lifetime; allow short public reuse.
const VERSION_API_CACHE_CONTROL = `public, max-age=${BROWSER_CACHE_TTL_SECONDS.versionApiResponseBrowserHttp}`;

// In-memory server caches shared with startup warmup
export const pranaStatsCache = createServerCache(SERVER_CACHE_TTL_MS.apiResponse);
export const summaryCache = createServerCache<string>(SERVER_CACHE_TTL_MS.summaryApiResponse);

/** Optional loader overrides so route tests do not need a live RPC. */
export type StakingApiLoaders = {
  loadConfig: () => Promise<StakingConfig>;
  loadAccount: (address: Address) => Promise<StakingAccountSnapshot>;
};

const DEFAULT_STAKING_API_LOADERS: StakingApiLoaders = {
  loadConfig: loadCachedStakingConfig,
  loadAccount: loadStakingAccount,
};

// Handles readonly GET API routes (stats, capital, summary, staking config/account, etc.)
export function createGetApiRouteHandler(
  rateLimiters: SwapRateLimiters,
  stakingLoaders: StakingApiLoaders = DEFAULT_STAKING_API_LOADERS,
): RequestHandler {
  return async function handleGetApiRequest(req, res, url): Promise<boolean> {
    // Public deploy identity — compare with GitHub `main` and the UI footer SHA.
    if (url.pathname === '/api/version') {
      sendJson(res, 200, loadVersionInfo(), { cacheControl: VERSION_API_CACHE_CONTROL });
      return true;
    }

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
      const requestedPage = Number(url.searchParams.get('page') ?? '1');
      const pageCount = Math.ceil(TOP_HOLDING_ADDRESSES.length / TOP_HOLDERS_PAGE_SIZE);
      const page = Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= pageCount
        ? requestedPage
        : 1;
      const result = await loadCachedTopHoldingAddresses(page);
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

    // Protocol config for the /stake/ UI — 30s browser + server cache.
    if (url.pathname === '/api/staking/config') {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        sendJson(res, 405, {
          error: 'method_not_allowed',
          message: 'Use GET for staking config.',
        });
        return true;
      }

      try {
        const result = await stakingLoaders.loadConfig();
        sendJson(res, 200, result, { cacheControl: READONLY_STAKING_CONFIG_CACHE_CONTROL });
      } catch (err) {
        console.error('Failed to load staking config:', formatErrorForLog(err));
        sendJson(res, 502, {
          error: 'upstream_unavailable',
          message: 'Failed to load staking config.',
        });
      }
      return true;
    }

    // Wallet-specific stakes/balance — no-store, rate-limited, requires valid address.
    if (url.pathname === '/api/staking/account') {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        sendJson(res, 405, {
          error: 'method_not_allowed',
          message: 'Use GET for staking account.',
        });
        return true;
      }

      // Validate before rate-limit so junk addresses do not spend IP/global RPC quota.
      const address = parseChecksumAddress(url.searchParams.get('address'));
      if (!address) {
        sendJson(res, 400, {
          error: 'invalid_address',
          message: 'Provide a valid wallet address.',
        });
        return true;
      }

      if (rateLimiters.isStakingAccountRateLimited(req)) {
        sendJson(res, 429, {
          error: 'rate_limited',
          message: 'Too many staking account requests.',
        });
        return true;
      }

      try {
        const result = await stakingLoaders.loadAccount(address);
        sendJson(res, 200, result, { cacheControl: STAKING_ACCOUNT_CACHE_CONTROL });
      } catch (err) {
        console.error('Failed to load staking account:', formatErrorForLog(err));
        sendJson(res, 502, {
          error: 'upstream_unavailable',
          message: 'Failed to load staking account.',
        });
      }
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
