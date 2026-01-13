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
  return 'application/octet-stream';
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
  const data = await fs.readFile(filePath);
  res.statusCode = 200;
  res.setHeader('Content-Type', contentTypeFor(filePath));
  res.end(data);
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

