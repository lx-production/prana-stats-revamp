/**
 * Helpers for serving Vite-precompressed `*.gz` siblings next to static files.
 * Build emits gzip level 9 once; runtime just picks the sibling when the client allows it.
 */
import path from 'node:path';

import type { IncomingMessage } from 'node:http';

/** Extensions we precompress at build time and may serve as `Content-Encoding: gzip`. */
const GZIP_ELIGIBLE_EXTENSIONS = new Set([
  '.js',
  '.css',
  '.html',
  '.json',
  '.svg',
  '.txt',
  '.md',
  '.xml',
  '.wasm',
]);

/** True when the client lists gzip in Accept-Encoding. */
export function clientAcceptsGzip(req: IncomingMessage): boolean {
  const raw = req.headers['accept-encoding'];
  if (typeof raw !== 'string' || !raw) return false;
  return /(?:^|,)\s*gzip\b/i.test(raw);
}

/** Whether this logical asset path is eligible for a `.gz` sibling. */
export function isGzipEligiblePath(filePath: string): boolean {
  return GZIP_ELIGIBLE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/** Path to the precompressed sibling (`file.js` → `file.js.gz`). */
export function gzipSiblingPath(filePath: string): string {
  return `${filePath}.gz`;
}
