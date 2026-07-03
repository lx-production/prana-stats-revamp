import http from 'node:http';
import path from 'node:path';
import { serveFile } from './serveFile.ts';
import { createServerCache } from './cacheHelpers.ts';
import { loadSwapQuote } from './loaders/swapQuote.ts';
import { loadPranaStats } from './loaders/pranaStats.ts';
import { loadSummaryMarkdown } from './loaders/summary.ts';
import { loadCachedCapital } from './loaders/capitalCached.ts';
import { loadCachedLpCapital } from './loaders/lpCapitalCached.ts';
import { loadCachedBondMetrics } from './loaders/bondMetricsCached.ts';
import { loadCachedStakingStats } from './loaders/stakingStatsCached.ts';
import { loadCachedTopHoldingAddresses } from './loaders/topHoldingAddresses.ts';
import { logSwapTransactionEvent, parseSwapTransactionLogRequest } from './loaders/swapLogs.ts';
import { DIST_DIR, PROJECT_ROOT, PUBLIC_DIR } from './projectRoot.ts';
import { SERVER_CACHE_TTL_MS, BROWSER_CACHE_TTL_SECONDS } from '../constants/cachePolicy.ts';
import { fileExists, readJsonBody, sendJson, sendText, rootDataJsonFilenameFromPathname, rootBondsJsonFilenameFromPathname, rootBuyDipsFilenameFromPathname } from './requestHelpers.ts';
import type { SwapQuoteRequest } from '../types/swap.types.ts';

const PORT = Number(process.env.PORT || 4173);
const READONLY_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.apiResponseBrowserHttp}`;
const READONLY_LP_CAPITAL_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.lpCapitalApiResponseBrowserHttp}`;
const READONLY_STAKING_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.stakingStatsApiResponseBrowserHttp}`;
const READONLY_BOND_METRICS_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.bondMetricsApiResponseBrowserHttp}`;
const SWAP_QUOTE_BODY_MAX_BYTES = 2048;
const SWAP_LOG_BODY_MAX_BYTES = 8192;
const SWAP_QUOTE_RATE_LIMIT = { windowMs: 60_000, maxRequests: 10 };
const SWAP_LOG_RATE_LIMIT = { windowMs: 60_000, maxRequests: 120 };
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60_000;
const TRUSTED_PROXY_ADDRESSES = new Set([
  '127.0.0.1',
  '::1',
  ...(process.env.TRUSTED_PROXY_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean)
    .map(normalizeSocketAddress),
]);

const pranaStatsCache = createServerCache(SERVER_CACHE_TTL_MS.apiResponse);
const summaryCache = createServerCache<string>(SERVER_CACHE_TTL_MS.summaryApiResponse);

type RateLimitBucket = {
  windowStartedAt: number;
  count: number;
};

const swapQuoteRateLimits = new Map<string, RateLimitBucket>();
const swapLogRateLimits = new Map<string, RateLimitBucket>();

function normalizeSocketAddress(address: string): string {
  return address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;
}

function isTrustedProxy(address: string): boolean {
  return TRUSTED_PROXY_ADDRESSES.has(normalizeSocketAddress(address));
}

function getRequestIp(req: http.IncomingMessage): string {
  const socketAddress = req.socket.remoteAddress ?? 'unknown';
  const forwardedFor = req.headers['x-forwarded-for'];

  if (isTrustedProxy(socketAddress) && forwardedFor) {
    const forwardedHeader = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
    const forwardedIps = forwardedHeader.split(',').map((ip) => ip.trim()).filter(Boolean);
    const proxyAppendedIp = forwardedIps[forwardedIps.length - 1];

    if (proxyAppendedIp) {
      return proxyAppendedIp;
    }
  }

  return normalizeSocketAddress(socketAddress);
}

function sweepRateLimitBuckets(
  buckets: Map<string, RateLimitBucket>,
  now: number,
  windowMs: number,
): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartedAt > windowMs) {
      buckets.delete(key);
    }
  }
}

function isRateLimited(
  req: http.IncomingMessage,
  buckets: Map<string, RateLimitBucket>,
  limit: { windowMs: number; maxRequests: number },
): boolean {
  const now = Date.now();
  const key = getRequestIp(req);
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStartedAt > limit.windowMs) {
    buckets.set(key, { windowStartedAt: now, count: 1 });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit.maxRequests;
}

const rateLimitCleanupTimer = setInterval(() => {
  const now = Date.now();
  sweepRateLimitBuckets(swapQuoteRateLimits, now, SWAP_QUOTE_RATE_LIMIT.windowMs);
  sweepRateLimitBuckets(swapLogRateLimits, now, SWAP_LOG_RATE_LIMIT.windowMs);
}, RATE_LIMIT_CLEANUP_INTERVAL_MS);
rateLimitCleanupTimer.unref();

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

async function warmApiCaches() {
  const warmups = [
    { name: '/api/summary', load: () => summaryCache(() => loadSummaryMarkdown()) },
    { name: '/api/staking-stats', load: () => loadCachedStakingStats() },
    { name: '/api/lp-capital', load: () => loadCachedLpCapital() },
    { name: '/api/bond-metrics', load: () => loadCachedBondMetrics() },
  ];

  console.log('Warming API caches...');

  const results = await Promise.allSettled(warmups.map((warmup) => warmup.load()));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn(`Failed to warm ${warmups[index].name}:`, result.reason);
    }
  });

  console.log('API cache warming finished.');
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/summary') {
      const result = await summaryCache(() => loadSummaryMarkdown());
      return sendText(res, 200, result, {
        cacheControl: READONLY_API_CACHE_CONTROL,
        contentType: 'text/markdown; charset=utf-8',
      });
    }

    // Endpoint the frontend can call for top holdings with a short-lived memory cache.
    if (url.pathname === '/api/top-holding-addresses') {
      const result = await loadCachedTopHoldingAddresses();
      return sendJson(res, 200, result, { cacheControl: READONLY_API_CACHE_CONTROL });
    }

    if (url.pathname === '/api/prana-stats') {
      const result = await pranaStatsCache(loadPranaStats);
      return sendJson(res, 200, result, { cacheControl: READONLY_API_CACHE_CONTROL });
    }

    if (url.pathname === '/api/staking-stats') {
      const result = await loadCachedStakingStats();
      return sendJson(res, 200, result, { cacheControl: READONLY_STAKING_API_CACHE_CONTROL });
    }

    if (url.pathname === '/api/capital') {
      const result = await loadCachedCapital();
      return sendJson(res, 200, result, { cacheControl: READONLY_API_CACHE_CONTROL });
    }

    if (url.pathname === '/api/lp-capital') {
      const result = await loadCachedLpCapital();
      return sendJson(res, 200, result, { cacheControl: READONLY_LP_CAPITAL_API_CACHE_CONTROL });
    }

    if (url.pathname === '/api/bond-metrics') {
      const result = await loadCachedBondMetrics();
      return sendJson(res, 200, result, { cacheControl: READONLY_BOND_METRICS_API_CACHE_CONTROL });
    }

    if (url.pathname === '/api/swap/quote') {
      if (req.method !== 'POST') {
        return sendJson(res, 405, {
          error: 'method_not_allowed',
          message: 'Use POST for swap quotes.',
        });
      }

      if (isRateLimited(req, swapQuoteRateLimits, SWAP_QUOTE_RATE_LIMIT)) {
        return sendJson(res, 429, {
          error: 'rate_limited',
          message: 'Too many swap quote requests. Please wait a moment and try again.',
        });
      }

      try {
        const body = await readJsonBody<SwapQuoteRequest>(req, SWAP_QUOTE_BODY_MAX_BYTES);
        const result = await loadSwapQuote(body);
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 400, {
          error: 'quote_failed',
          message: sanitizeSwapErrorMessage(err, 'Failed to load swap quote.'),
        });
      }
    }

    if (url.pathname === '/api/swap/log') {
      if (req.method !== 'POST') {
        return sendJson(res, 405, {
          error: 'method_not_allowed',
          message: 'Use POST for swap logs.',
        });
      }

      if (isRateLimited(req, swapLogRateLimits, SWAP_LOG_RATE_LIMIT)) {
        return sendJson(res, 429, {
          error: 'rate_limited',
          message: 'Too many swap log requests.',
        });
      }

      try {
        const body = await readJsonBody<unknown>(req, SWAP_LOG_BODY_MAX_BYTES);
        const payload = parseSwapTransactionLogRequest(body);
        logSwapTransactionEvent(payload);
        return sendJson(res, 200, { ok: true });
      } catch (err) {
        return sendJson(res, 400, {
          error: 'log_failed',
          message: sanitizeSwapErrorMessage(err, 'Failed to write swap log.'),
        });
      }
    }

    // Serve data JSON directly from project root so live updates are visible
    // without rebuilding dist/.
    const rootDataFilename = rootDataJsonFilenameFromPathname(url.pathname);
    if (rootDataFilename) {
      const rootDataPath = path.join(PROJECT_ROOT, rootDataFilename);
      if (await fileExists(rootDataPath)) {
        return await serveFile(req, res, rootDataPath);
      }
      return sendJson(res, 404, { error: 'not_found' });
    }

    const rootBondsFilename = rootBondsJsonFilenameFromPathname(url.pathname);
    if (rootBondsFilename) {
      const rootBondsPath = path.join(PROJECT_ROOT, rootBondsFilename);
      if (await fileExists(rootBondsPath)) {
        return await serveFile(req, res, rootBondsPath);
      }
      return sendJson(res, 404, { error: 'not_found' });
    }

    const rootBuyDipsFilename = rootBuyDipsFilenameFromPathname(url.pathname);
    if (rootBuyDipsFilename) {
      const rootBuyDipsPath = path.join(PROJECT_ROOT, rootBuyDipsFilename);
      if (await fileExists(rootBuyDipsPath)) {
        return await serveFile(req, res, rootBuyDipsPath);
      }
      return sendJson(res, 404, { error: 'not_found' });
    }

    // Keep legacy fallback image URL working by serving the current icon asset.
    // This avoids falling back to index.html (no-cache) for the missing PNG file.
    if (url.pathname === '/prana-coin-fallback.png') {
      const fallbackIconPath = path.join(PUBLIC_DIR, 'assets', 'icons', 'prana.svg');
      if (await fileExists(fallbackIconPath)) {
        return await serveFile(req, res, fallbackIconPath);
      }
    }

    // Static build: serve from dist/ first.
    const requested = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    const distPath = path.join(DIST_DIR, requested);
    if (await fileExists(distPath)) {
      return await serveFile(req, res, distPath);
    }

    // Public assets should still work even if dist/ is stale or missing a copied file.
    const publicPath = path.join(PUBLIC_DIR, requested);
    if (await fileExists(publicPath)) {
      return await serveFile(req, res, publicPath);
    }

    const fallback = path.join(DIST_DIR, 'index.html');
    if (await fileExists(fallback)) {
      return await serveFile(req, res, fallback);
    }

    sendJson(res, 404, { error: 'not_found' });
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { error: 'internal_error' });
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  void warmApiCaches();
});
