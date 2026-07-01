import http from 'node:http';
import path from 'node:path';
import { serveFile } from './serveFile.ts';
import { loadPranaStats } from './loaders/pranaStats.ts';
import { loadCachedBondMetrics } from './loaders/bondMetricsCached.ts';
import { loadSummaryMarkdown } from './loaders/summary.ts';
import { loadCachedCapital } from './loaders/capitalCached.ts';
import { loadCachedLpCapital } from './loaders/lpCapitalCached.ts';
import { loadCachedStakingStats } from './loaders/stakingStatsCached.ts';
import { loadCachedTopHoldingAddresses } from './loaders/topHoldingAddresses.ts';
import { loadSwapQuote } from './loaders/swapQuote.ts';
import { logSwapTransactionEvent, parseSwapTransactionLogRequest } from './loaders/swapLogs.ts';
import { DIST_DIR, PROJECT_ROOT, PUBLIC_DIR } from './projectRoot.ts';
import { createServerCache } from './cacheHelpers.ts';
import { SERVER_CACHE_TTL_MS, BROWSER_CACHE_TTL_SECONDS } from '../constants/cachePolicy.ts';
import { fileExists, readJsonBody, sendJson, sendText, rootDataJsonFilenameFromPathname, rootBondsJsonFilenameFromPathname, rootBuyDipsFilenameFromPathname } from './requestHelpers.ts';
import type { SwapQuoteRequest } from '../types/swap.types.ts';

const PORT = Number(process.env.PORT || 4173);
const READONLY_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.apiResponseBrowserHttp}`;
const READONLY_LP_CAPITAL_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.lpCapitalApiResponseBrowserHttp}`;
const READONLY_STAKING_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.stakingStatsApiResponseBrowserHttp}`;
const READONLY_BOND_METRICS_API_CACHE_CONTROL = `private, max-age=${BROWSER_CACHE_TTL_SECONDS.bondMetricsApiResponseBrowserHttp}`;

const pranaStatsCache = createServerCache(SERVER_CACHE_TTL_MS.apiResponse);
const summaryCache = createServerCache<string>(SERVER_CACHE_TTL_MS.summaryApiResponse);

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

      try {
        const body = await readJsonBody<SwapQuoteRequest>(req);
        const result = await loadSwapQuote(body);
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 400, {
          error: 'quote_failed',
          message: err instanceof Error ? err.message : 'Failed to load swap quote.',
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

      try {
        const body = await readJsonBody<unknown>(req);
        const payload = parseSwapTransactionLogRequest(body);
        logSwapTransactionEvent(payload);
        return sendJson(res, 200, { ok: true });
      } catch (err) {
        return sendJson(res, 400, {
          error: 'log_failed',
          message: err instanceof Error ? err.message : 'Failed to write swap log.',
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
