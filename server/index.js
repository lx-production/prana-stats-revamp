import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateBondsV2 } from '../scripts/update-bonds-v2.js';
import { serveFile } from './serveFile.js';
import {
  fileExists,
  sendJson,
  rootDataJsonFilenameFromPathname,
  rootBondsJsonFilenameFromPathname,
} from './requestHelpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const PORT = Number(process.env.PORT || 4173);

// Tracks in-flight refresh requests to avoid multiple concurrent calls.
let refreshInFlight = null;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // Endpoint the frontend can call on page load.
    if (url.pathname === '/api/bonds-v2/refresh') {
      if (!refreshInFlight) {
        refreshInFlight = (async () => {
          try {
            return await updateBondsV2();
          } finally {
            refreshInFlight = null;
          }
        })();
      }

      const result = await refreshInFlight;
      return sendJson(res, 200, result); // useTotalV2BondPranaVolume uses this to decide whether to force-refetch /bonds_v2.json
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
