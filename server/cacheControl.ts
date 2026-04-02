import path from 'node:path';
import { CACHE_TTL_SECONDS } from '../constants/cachePolicy.js';

export function cacheControlFor(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath);

  // HTML should always revalidate so deploys show up immediately.
  if (ext === '.html') return 'no-cache';

  // Fallback image and coin model use stable URLs (public/), cache like other static assets.
  if (base === 'prana-coin-fallback.png' || base === 'prana-coin.glb') {
    return `public, max-age=${CACHE_TTL_SECONDS.staticAssetsHttp}, immutable`;
  }

  // Data JSON changes over time, but it is safe to let the browser reuse it briefly
  // without an immediate roundtrip. After max-age expires, normal revalidation applies.
  if (ext === '.json' && base.startsWith('data_')) {
    return `public, max-age=${CACHE_TTL_SECONDS.rootDataJsonHttp}`;
  }

  // Bonds JSON is refreshed by the API endpoint and served from project root.
  // Keep it aligned with the rest of the short-lived generated JSON.
  if (ext === '.json' && base === 'bonds_v2.json') {
    return `public, max-age=${CACHE_TTL_SECONDS.rootBondsJsonHttp}`;
  }

  // Buy dips JSON is generated data served from project root.
  // Keep it aligned with the other short-lived JSON resources.
  if (ext === '.json' && base === 'buy_dips.json') {
    return `public, max-age=${CACHE_TTL_SECONDS.rootBuyDipsJsonHttp}`;
  }

  // Other JSON: be safe and revalidate.
  if (ext === '.json') return 'no-cache';

  // Vite build assets are content-hashed (dist/assets/*), so we can cache aggressively.
  // This includes the main built JS bundle like dist/assets/index-<hash>.js.
  if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    return `public, max-age=${CACHE_TTL_SECONDS.staticAssetsHttp}, immutable`;
  }

  return null;
}
