import path from 'node:path';
import { DIST_DIR, PROJECT_ROOT, PUBLIC_DIR } from './projectRoot.ts';
import {
  fileExists,
  rootBondsJsonFilenameFromPathname,
  rootBuyDipsFilenameFromPathname,
  rootDataJsonFilenameFromPathname,
  sendJson,
} from './helpers/requestHelpers.ts';
import { serveFile } from './serveFile.ts';
import type { RequestHandler } from './types/httpTypes.ts';

export const handleStaticRequest: RequestHandler = async function handleStaticRequest(
  req,
  res,
  url,
): Promise<boolean> {
  // Serve data JSON directly from project root so live updates are visible
  // without rebuilding dist/.
  const rootDataFilename = rootDataJsonFilenameFromPathname(url.pathname);
  if (rootDataFilename) {
    const rootDataPath = path.join(PROJECT_ROOT, rootDataFilename);
    if (await fileExists(rootDataPath)) {
      await serveFile(req, res, rootDataPath);
      return true;
    }
    sendJson(res, 404, { error: 'not_found' });
    return true;
  }

  const rootBondsFilename = rootBondsJsonFilenameFromPathname(url.pathname);
  if (rootBondsFilename) {
    const rootBondsPath = path.join(PROJECT_ROOT, rootBondsFilename);
    if (await fileExists(rootBondsPath)) {
      await serveFile(req, res, rootBondsPath);
      return true;
    }
    sendJson(res, 404, { error: 'not_found' });
    return true;
  }

  const rootBuyDipsFilename = rootBuyDipsFilenameFromPathname(url.pathname);
  if (rootBuyDipsFilename) {
    const rootBuyDipsPath = path.join(PROJECT_ROOT, rootBuyDipsFilename);
    if (await fileExists(rootBuyDipsPath)) {
      await serveFile(req, res, rootBuyDipsPath);
      return true;
    }
    sendJson(res, 404, { error: 'not_found' });
    return true;
  }

  // Keep legacy fallback image URL working by serving the current icon asset.
  // This avoids falling back to index.html (no-cache) for the missing PNG file.
  if (url.pathname === '/prana-coin-fallback.png') {
    const fallbackIconPath = path.join(PUBLIC_DIR, 'assets', 'icons', 'prana.svg');
    if (await fileExists(fallbackIconPath)) {
      await serveFile(req, res, fallbackIconPath);
      return true;
    }
  }

  // Static build: serve from dist/ first.
  const requested = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const distPath = path.join(DIST_DIR, requested);
  if (await fileExists(distPath)) {
    await serveFile(req, res, distPath);
    return true;
  }

  // Public assets should still work even if dist/ is stale or missing a copied file.
  const publicPath = path.join(PUBLIC_DIR, requested);
  if (await fileExists(publicPath)) {
    await serveFile(req, res, publicPath);
    return true;
  }

  const fallback = path.join(DIST_DIR, 'index.html');
  if (await fileExists(fallback)) {
    await serveFile(req, res, fallback);
    return true;
  }

  return false;
};
