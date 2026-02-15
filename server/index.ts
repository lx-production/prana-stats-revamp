import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveFile } from './serveFile.ts';
import { updateBondsV2 } from '../scripts/update-bonds-v2.ts';
import { updateTopHoldingAddresses } from '../scripts/update-top-holding-addresses.ts';
import type { UpdateBondsV2Result } from './types/indexTypes.ts';
import type { UpdateTopHoldingAddressesResult } from '../scripts/types/updateTopHoldingAddressesTypes.ts';
import { fileExists, sendJson, rootDataJsonFilenameFromPathname, rootBondsJsonFilenameFromPathname, rootTopHoldingAddressesFilenameFromPathname } from './requestHelpers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // Endpoint the frontend can call on page load/reload
    if (url.pathname === '/api/refresh-bonds') {
      const now = Date.now();
      if (bondsLastResult && now - bondsLastRefreshAt < BONDS_REFRESH_TTL_MS) { // if last refresh < 30s, return cache
        return sendJson(res, 200, bondsLastResult);
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

      const result = await refreshInFlight!;
      bondsLastResult = result;
      bondsLastRefreshAt = Date.now();
      return sendJson(res, 200, result); // usePranaStats uses this to decide whether to force-refetch /bonds_v2.json
    }

    // Endpoint the frontend can call on page load.
    if (url.pathname === '/api/refresh-holdings') {
      const now = Date.now();
      if (topHoldingLastResult && now - topHoldingLastRefreshAt < TOP_HOLDING_REFRESH_TTL_MS) {
        return sendJson(res, 200, topHoldingLastResult);
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

      const result = await topHoldingRefreshInFlight!;
      topHoldingLastResult = result;
      topHoldingLastRefreshAt = Date.now();
      return sendJson(res, 200, result); // useTopHoldingAddresses uses this to decide whether to force-refetch /top_holding_addresses.json
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
