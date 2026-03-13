import http from 'node:http';
import path from 'node:path';
import { serveFile } from './serveFile.ts';
import { DIST_DIR, PROJECT_ROOT, PUBLIC_DIR } from './projectRoot.ts';
import { CACHE_TTL_SECONDS } from '../constants/cachePolicy.js';
import { loadCapital } from './loaders/capital.ts';
import { loadLpCapital } from './loaders/lpCapital.ts';
import { loadPranaStats } from './loaders/pranaStats.ts';
import { loadBondMetrics } from './loaders/bondMetrics.ts';
import {
  fileExists,
  sendJson,
  rootDataJsonFilenameFromPathname,
  rootBondsJsonFilenameFromPathname,
  rootTopHoldingAddressesFilenameFromPathname,
  rootBuyDipsFilenameFromPathname,
} from './requestHelpers.ts';
import { ensureBondsRefreshed, ensureHoldingsRefreshed, getCachedApiValue, type CachedValue } from './cacheHelpers.ts';
import type { CapitalApiResponse, LpCapitalApiResponse, PranaStatsApiResponse, BondMetricsApiResponse } from '../types/api.types.ts';

const PORT = Number(process.env.PORT || 4173);
const READONLY_API_CACHE_CONTROL = `private, max-age=${CACHE_TTL_SECONDS.apiResponseBrowserHttp}`;

let pranaStatsCache: CachedValue<PranaStatsApiResponse> | null = null;
let pranaStatsInFlight: Promise<PranaStatsApiResponse> | null = null;
let capitalCache: CachedValue<CapitalApiResponse> | null = null;
let capitalInFlight: Promise<CapitalApiResponse> | null = null;
let lpCapitalCache: CachedValue<LpCapitalApiResponse> | null = null;
let lpCapitalInFlight: Promise<LpCapitalApiResponse> | null = null;
let bondMetricsCache: CachedValue<BondMetricsApiResponse> | null = null;
let bondMetricsInFlight: Promise<BondMetricsApiResponse> | null = null;

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
      const result = await ensureHoldingsRefreshed();
      return sendJson(res, 200, result, { cacheControl: READONLY_API_CACHE_CONTROL });
    }

    if (url.pathname === '/api/prana-stats') {
      const result = await getCachedApiValue(
        pranaStatsCache,
        pranaStatsInFlight,
        async () => {
          await ensureBondsRefreshed();
          return await loadPranaStats();
        },
        (value) => {
          pranaStatsCache = value;
        },
        (value) => {
          pranaStatsInFlight = value;
        }
      );
      return sendJson(res, 200, result, { cacheControl: READONLY_API_CACHE_CONTROL });
    }

    if (url.pathname === '/api/capital') {
      const result = await getCachedApiValue(
        capitalCache,
        capitalInFlight,
        loadCapital,
        (value) => {
          capitalCache = value;
        },
        (value) => {
          capitalInFlight = value;
        }
      );
      return sendJson(res, 200, result, { cacheControl: READONLY_API_CACHE_CONTROL });
    }

    if (url.pathname === '/api/lp-capital') {
      const result = await getCachedApiValue(
        lpCapitalCache,
        lpCapitalInFlight,
        loadLpCapital,
        (value) => {
          lpCapitalCache = value;
        },
        (value) => {
          lpCapitalInFlight = value;
        }
      );
      return sendJson(res, 200, result, { cacheControl: READONLY_API_CACHE_CONTROL });
    }

    if (url.pathname === '/api/bond-metrics') {
      const result = await getCachedApiValue(
        bondMetricsCache,
        bondMetricsInFlight,
        async () => {
          await ensureBondsRefreshed();
          return await loadBondMetrics();
        },
        (value) => {
          bondMetricsCache = value;
        },
        (value) => {
          bondMetricsInFlight = value;
        }
      );
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
