import http from 'node:http';
import path from 'node:path';
import { serveFile } from './serveFile.ts';
import { updateBondsV2 } from '../scripts/update-bonds-v2.ts';
import { updateTopHoldingAddresses } from '../scripts/update-top-holding-addresses.ts';
import type { UpdateBondsV2Result } from './types/indexTypes.ts';
import type { UpdateTopHoldingAddressesResult } from '../scripts/types/updateTopHoldingAddressesTypes.ts';
import type { CapitalApiResponse, LpCapitalApiResponse, PranaStatsApiResponse, BondMetricsApiResponse } from '../types/api.types.ts';
import {
  fileExists,
  sendJson,
  rootDataJsonFilenameFromPathname,
  rootBondsJsonFilenameFromPathname,
  rootTopHoldingAddressesFilenameFromPathname,
  rootBuyDipsFilenameFromPathname,
} from './requestHelpers.ts';
import { DIST_DIR, PROJECT_ROOT } from './projectRoot.ts';
import { loadCapital } from './loaders/capital.ts';
import { loadLpCapital } from './loaders/lpCapital.ts';
import { loadPranaStats } from './loaders/pranaStats.ts';
import { loadBondMetrics } from './loaders/bondMetrics.ts';
const PORT = Number(process.env.PORT || 4173);

// Tracks in-flight refresh requests to avoid multiple concurrent calls.
let refreshInFlight: Promise<UpdateBondsV2Result> | null = null;
let bondsLastRefreshAt = 0;
let bondsLastResult: UpdateBondsV2Result | null = null;
const BONDS_REFRESH_TTL_MS = 30_000; // 30 seconds

let topHoldingRefreshInFlight: Promise<UpdateTopHoldingAddressesResult> | null = null;
let topHoldingLastRefreshAt = 0;
let topHoldingLastResult: UpdateTopHoldingAddressesResult | null = null;
const TOP_HOLDING_REFRESH_TTL_MS = 30_000;

type CachedValue<T> = {
  value: T;
  timestamp: number;
};

const API_CACHE_TTL_MS = 30_000;

let pranaStatsCache: CachedValue<PranaStatsApiResponse> | null = null;
let pranaStatsInFlight: Promise<PranaStatsApiResponse> | null = null;
let capitalCache: CachedValue<CapitalApiResponse> | null = null;
let capitalInFlight: Promise<CapitalApiResponse> | null = null;
let lpCapitalCache: CachedValue<LpCapitalApiResponse> | null = null;
let lpCapitalInFlight: Promise<LpCapitalApiResponse> | null = null;
let bondMetricsCache: CachedValue<BondMetricsApiResponse> | null = null;
let bondMetricsInFlight: Promise<BondMetricsApiResponse> | null = null;

async function ensureBondsRefreshed(): Promise<UpdateBondsV2Result> {
  const now = Date.now();
  if (bondsLastResult && now - bondsLastRefreshAt < BONDS_REFRESH_TTL_MS) {
    return bondsLastResult;
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const result = await updateBondsV2();
        bondsLastResult = result;
        bondsLastRefreshAt = Date.now();
        return result;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  const result = await refreshInFlight;
  bondsLastResult = result;
  bondsLastRefreshAt = Date.now();
  return result;
}

async function ensureHoldingsRefreshed(): Promise<UpdateTopHoldingAddressesResult> {
  const now = Date.now();
  if (topHoldingLastResult && now - topHoldingLastRefreshAt < TOP_HOLDING_REFRESH_TTL_MS) {
    return topHoldingLastResult;
  }

  if (!topHoldingRefreshInFlight) {
    topHoldingRefreshInFlight = (async () => {
      try {
        const result = await updateTopHoldingAddresses();
        topHoldingLastResult = result;
        topHoldingLastRefreshAt = Date.now();
        return result;
      } finally {
        topHoldingRefreshInFlight = null;
      }
    })();
  }

  const result = await topHoldingRefreshInFlight;
  topHoldingLastResult = result;
  topHoldingLastRefreshAt = Date.now();
  return result;
}

async function getCachedApiValue<T>(
  cache: CachedValue<T> | null,
  inFlight: Promise<T> | null,
  loader: () => Promise<T>,
  setCache: (value: CachedValue<T> | null) => void,
  setInFlight: (value: Promise<T> | null) => void,
): Promise<T> {
  const now = Date.now();
  if (cache && now - cache.timestamp < API_CACHE_TTL_MS) {
    return cache.value;
  }

  if (!inFlight) {
    const nextPromise = (async () => {
      try {
        const value = await loader();
        setCache({ value, timestamp: Date.now() });
        return value;
      } finally {
        setInFlight(null);
      }
    })();
    setInFlight(nextPromise);
    inFlight = nextPromise;
  }

  return await inFlight;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // Endpoint the frontend can call on page load/reload
    if (url.pathname === '/api/refresh-bonds' || url.pathname === '/api/bonds-v2/refresh') {
      const result = await ensureBondsRefreshed();
      return sendJson(res, 200, result);
    }

    // Endpoint the frontend can call on page load.
    if (url.pathname === '/api/refresh-holdings') {
      const result = await ensureHoldingsRefreshed();
      return sendJson(res, 200, result);
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
      return sendJson(res, 200, result);
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
      return sendJson(res, 200, result);
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
      return sendJson(res, 200, result);
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
      return sendJson(res, 200, result);
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

    // Static build: serve from dist/ (with SPA fallback to index.html).
    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    const distPath = path.join(DIST_DIR, requested);
    if (await fileExists(distPath)) {
      return await serveFile(req, res, distPath);
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
