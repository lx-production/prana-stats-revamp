import http from 'node:http';
import path from 'node:path';
import { serveFile } from './serveFile.ts';
import { DIST_DIR, PROJECT_ROOT, PUBLIC_DIR } from './projectRoot.ts';
import { CACHE_TTL_MS, CACHE_TTL_SECONDS } from '../constants/cachePolicy.js';
import { loadCapital } from './loaders/capital.ts';
import { loadLpCapital } from './loaders/lpCapital.ts';
import { loadPranaStats } from './loaders/pranaStats.ts';
import { loadStakingStats } from './loaders/stakingStats.ts';
import { loadBondMetrics } from './loaders/bondMetrics.ts';
import { createServerCache, ensureBondsRefreshed, ensureHoldingsRefreshed } from './cacheHelpers.ts';
import { fileExists, sendJson, rootDataJsonFilenameFromPathname, rootBondsJsonFilenameFromPathname, rootTopHoldingAddressesFilenameFromPathname, rootBuyDipsFilenameFromPathname } from './requestHelpers.ts';

const PORT = Number(process.env.PORT || 4173);
const READONLY_API_CACHE_CONTROL = `private, max-age=${CACHE_TTL_SECONDS.apiResponseBrowserHttp}`;

const pranaStatsCache = createServerCache(CACHE_TTL_MS.apiResponse);
const stakingStatsCache = createServerCache(CACHE_TTL_MS.apiResponse);
const capitalCache = createServerCache(CACHE_TTL_MS.apiResponse);
const lpCapitalCache = createServerCache(CACHE_TTL_MS.apiResponse);
const bondMetricsCache = createServerCache(CACHE_TTL_MS.apiResponse);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // Endpoint the frontend can call on page load/reload
    if (url.pathname === '/api/refresh-bonds' || url.pathname === '/api/bonds-v2/refresh-bonds') {
      const result = await ensureBondsRefreshed();
      return sendJson(res, 200, result, { cacheControl: READONLY_API_CACHE_CONTROL });
    }

    // Endpoint the frontend can call on page load.
    if (url.pathname === '/api/refresh-holdings') {
      const rawPage = Number(url.searchParams.get('page') ?? '1');
      const page = Number.isFinite(rawPage) ? rawPage : 1;
      const result = await ensureHoldingsRefreshed(page);
      return sendJson(res, 200, result, { cacheControl: READONLY_API_CACHE_CONTROL });
    }

    if (url.pathname === '/api/prana-stats') {
      const result = await pranaStatsCache(loadPranaStats);
      return sendJson(res, 200, result, { cacheControl: READONLY_API_CACHE_CONTROL });
    }

    if (url.pathname === '/api/staking-stats') {
      const result = await stakingStatsCache(loadStakingStats);
      return sendJson(res, 200, result, { cacheControl: READONLY_API_CACHE_CONTROL });
    }

    if (url.pathname === '/api/capital') {
      const result = await capitalCache(loadCapital);
      return sendJson(res, 200, result, { cacheControl: READONLY_API_CACHE_CONTROL });
    }

    if (url.pathname === '/api/lp-capital') {
      const result = await lpCapitalCache(loadLpCapital);
      return sendJson(res, 200, result, { cacheControl: READONLY_API_CACHE_CONTROL });
    }

    if (url.pathname === '/api/bond-metrics') {
      const result = await bondMetricsCache(async () => {
        await ensureBondsRefreshed();
        return await loadBondMetrics();
      });
      return sendJson(res, 200, result, { cacheControl: READONLY_API_CACHE_CONTROL });
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

    const rootTopHoldingAddressesFilename = rootTopHoldingAddressesFilenameFromPathname(url.pathname);
    if (rootTopHoldingAddressesFilename) {
      const rootTopHoldingAddressesPath = path.join(PROJECT_ROOT, rootTopHoldingAddressesFilename);
      if (await fileExists(rootTopHoldingAddressesPath)) {
        return await serveFile(req, res, rootTopHoldingAddressesPath);
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
});
