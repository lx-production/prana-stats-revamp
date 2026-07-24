import path from 'node:path';
import { tryServeFile } from './helpers/tryServeFile.ts';
import { DIST_DIR, PROJECT_ROOT, PUBLIC_DIR } from './projectRoot.ts';
import {
  sendJson,
  sendRedirect,
  rootDataJsonFilenameFromPathname,
} from './helpers/requestHelpers.ts';
import {
  STAKE_PATH,
  isStakePath,
  GUIDE_SWAP_PATH,
  STAKE_CANONICAL_PATH,
  isGuideSwapPath,
  GUIDE_STAKING_PATH,
  isGuideStakingPath,
  GUIDE_SWAP_CANONICAL_PATH,
  GUIDE_STAKING_CANONICAL_PATH,
} from '../constants/appRoutes.ts';

import type { RequestHandler } from './types/httpTypes.ts';

/** Optional overrides so tests can point at a fixture dist/ without a real build. */
export type StaticRouteOptions = {
  distDir?: string;
};

/** Bare path → trailing-slash canonical URL for SPA document routes. */
const SPA_TRAILING_SLASH_REDIRECTS = [
  { bare: STAKE_PATH, canonical: STAKE_CANONICAL_PATH },
  { bare: GUIDE_SWAP_PATH, canonical: GUIDE_SWAP_CANONICAL_PATH },
  { bare: GUIDE_STAKING_PATH, canonical: GUIDE_STAKING_CANONICAL_PATH },
] as const;

/**
 * Builds the static/SPA request handler.
 * Production uses DIST_DIR; tests inject a temp dir with index.html.
 */
export function createStaticRequestHandler(options: StaticRouteOptions = {}): RequestHandler {
  const distDir = options.distDir ?? DIST_DIR;

  return async function handleStaticRequest(req, res, url): Promise<boolean> {
    // Normalize trailing slash for stake + guide document routes.
    for (const route of SPA_TRAILING_SLASH_REDIRECTS) {
      if (url.pathname === route.bare) {
        sendRedirect(res, 308, `${route.canonical}${url.search}`);
        return true;
      }
    }

    // Serve the SPA shell early for stake/guide trees so refresh does not 404
    // on directory-like paths before the general fallback.
    if (
      isStakePath(url.pathname) ||
      isGuideSwapPath(url.pathname) ||
      isGuideStakingPath(url.pathname)
    ) {
      const spaShell = path.join(distDir, 'index.html');
      if (await tryServeFile(req, res, spaShell)) return true;
      return false;
    }

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
    const distPath = path.join(distDir, requested);
    if (await tryServeFile(req, res, distPath)) return true;

    // Public assets should still work even if dist/ is stale or missing a copied file.
    const publicPath = path.join(PUBLIC_DIR, requested);
    if (await tryServeFile(req, res, publicPath)) return true;

    const fallback = path.join(distDir, 'index.html');
    if (await tryServeFile(req, res, fallback)) return true;

    return false;
  };
}

export const handleStaticRequest = createStaticRequestHandler();
