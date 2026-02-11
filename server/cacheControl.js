import path from 'node:path';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365; // 31536000
const DATA_JSON_CACHE_SECONDS = 60 * 60; // 1 hour

export function cacheControlFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath);

  // HTML should always revalidate so deploys show up immediately.
  if (ext === '.html') return 'no-cache';

  // Data JSON is static-ish; cache it to avoid refetching on every page load.
  // (We don't mark it immutable because filenames are not content-hashed.)
  if (ext === '.json' && base.startsWith('data_')) {
    return `public, max-age=${DATA_JSON_CACHE_SECONDS}, must-revalidate`;
  }

  // Bonds JSON is refreshed by the API endpoint and served from project root.
  // Cache for 1 hour to reduce repeat network fetches.
  if (ext === '.json' && base === 'bonds_v2.json') {
    return `public, max-age=${DATA_JSON_CACHE_SECONDS}, must-revalidate`;
  }

  // Other JSON: be safe and revalidate.
  if (ext === '.json') return 'no-cache';

  // Vite build assets are content-hashed (dist/assets/*), so we can cache aggressively.
  // This includes the main built JS bundle like dist/assets/index-<hash>.js.
  if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    return `public, max-age=${ONE_YEAR_SECONDS}, immutable`;
  }

  return null;
}
