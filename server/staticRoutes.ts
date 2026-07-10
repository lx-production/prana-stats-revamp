import path from 'node:path';
import { tryServeFile } from './helpers/tryServeFile.ts';
import { DIST_DIR, PROJECT_ROOT, PUBLIC_DIR } from './projectRoot.ts';
import { rootDataJsonFilenameFromPathname, sendJson } from './helpers/requestHelpers.ts';

import type { RequestHandler } from './types/httpTypes.ts';

export const handleStaticRequest: RequestHandler = async function handleStaticRequest(req, res, url): Promise<boolean> {
  // Serve data JSON directly from project root so live updates are visible
  // without rebuilding dist/.
  const rootDataFilename = rootDataJsonFilenameFromPathname(url.pathname);
  if (rootDataFilename) {
    const rootDataPath = path.join(PROJECT_ROOT, rootDataFilename);
    if (await tryServeFile(req, res, rootDataPath)) return true;
    sendJson(res, 404, { error: 'not_found' });
    return true;
  }

  if (url.pathname === '/bonds_v2.json') {
    const rootBondsPath = path.join(PROJECT_ROOT, 'bonds_v2.json');
    if (await tryServeFile(req, res, rootBondsPath)) return true;
    sendJson(res, 404, { error: 'not_found' });
    return true;
  }

  if (url.pathname === '/buy_dips.json') {
    const rootBuyDipsPath = path.join(PROJECT_ROOT, 'buy_dips.json');
    if (await tryServeFile(req, res, rootBuyDipsPath)) return true;
    sendJson(res, 404, { error: 'not_found' });
    return true;
  }

  // Keep legacy fallback image URL working by serving the current icon asset.
  // This avoids falling back to index.html (no-cache) for the missing PNG file.
  if (url.pathname === '/prana-coin-fallback.png') {
    const fallbackIconPath = path.join(PUBLIC_DIR, 'assets', 'icons', 'prana.svg');
    if (await tryServeFile(req, res, fallbackIconPath)) return true;
  }

  // Static build: serve from dist/ first.
  const requested = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const distPath = path.join(DIST_DIR, requested);
  if (await tryServeFile(req, res, distPath)) return true;

  // Public assets should still work even if dist/ is stale or missing a copied file.
  const publicPath = path.join(PUBLIC_DIR, requested);
  if (await tryServeFile(req, res, publicPath)) return true;

  const fallback = path.join(DIST_DIR, 'index.html');
  if (await tryServeFile(req, res, fallback)) return true;

  return false;
};
