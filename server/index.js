import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { updateBondsV2 } from '../scripts/update-bonds-v2.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

const PORT = Number(process.env.PORT || 4173);

let refreshInFlight = null;

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365; // 31536000

// Simple in-memory cache for static files (mostly for dist/assets/*).
// Keyed by absolute file path and invalidated when file mtime changes.
const fileCache = new Map();

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.ico') return 'image/x-icon';
  if (ext === '.glb') return 'model/gltf-binary';
  if (ext === '.gltf') return 'model/gltf+json; charset=utf-8';
  return 'application/octet-stream';
}

function cacheControlFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  // HTML should always revalidate so deploys show up immediately.
  if (ext === '.html') return 'no-cache';

  // JSON files can change frequently; force revalidation.
  if (ext === '.json') return 'no-cache';

  // Vite build assets are content-hashed (dist/assets/*), so we can cache aggressively.
  // This includes the main built JS bundle like dist/assets/index-<hash>.js.
  if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    return `public, max-age=${ONE_YEAR_SECONDS}, immutable`;
  }

  return null;
}

async function fileExists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function serveFile(res, filePath) {
  const stat = await fs.stat(filePath);

  const cached = fileCache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    res.statusCode = 200;
    res.setHeader('Content-Type', cached.contentType);
    if (cached.cacheControl) res.setHeader('Cache-Control', cached.cacheControl);
    res.end(cached.data);
    return;
  }

  const data = await fs.readFile(filePath);
  res.statusCode = 200;
  const contentType = contentTypeFor(filePath);
  res.setHeader('Content-Type', contentType);
  const cacheControl = cacheControlFor(filePath);
  if (cacheControl) res.setHeader('Cache-Control', cacheControl);
  res.end(data);

  // Cache only if it has an explicit cache policy (mainly dist/assets/*).
  if (cacheControl) {
    fileCache.set(filePath, {
      mtimeMs: stat.mtimeMs,
      data,
      contentType,
      cacheControl,
    });
  }
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

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
      return sendJson(res, 200, result);
    }

    // Always serve the JSON files directly from repo root (so updates are reflected immediately).
    if (url.pathname === '/bonds_v2.json' || url.pathname === '/bonds_v2_details.json') {
      const filePath = path.join(PROJECT_ROOT, url.pathname.slice(1));
      if (!(await fileExists(filePath))) {
        return sendJson(res, 404, { error: 'not_found' });
      }
      return await serveFile(res, filePath);
    }

    // Static build: serve from dist/ (with SPA fallback to index.html).
    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    const distPath = path.join(DIST_DIR, requested);
    if (await fileExists(distPath)) {
      return await serveFile(res, distPath);
    }

    const fallback = path.join(DIST_DIR, 'index.html');
    if (await fileExists(fallback)) {
      return await serveFile(res, fallback);
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

