import fs from 'node:fs/promises';
import path from 'node:path';
import { cacheControlFor } from './cacheControl.ts';
import { setSecurityHeaders } from './securityHeaders.ts';
import { fileExists } from './helpers/requestHelpers.ts';
import {
  clientAcceptsGzip,
  gzipSiblingPath,
  isGzipEligiblePath,
} from './helpers/staticGzip.ts';

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { CachedStaticFile, StaticFileCache } from './types/serveFileTypes.ts';

// Simple in-memory cache for static files (mostly for dist/assets/*).
// Keyed by absolute file path (+ encoding) and invalidated when file mtime changes.
const fileCache: StaticFileCache = new Map();

function contentTypeFor(filePath: string): string {
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

function cacheKeyFor(filePath: string, contentEncoding: string | undefined): string {
  return contentEncoding ? `${filePath}::${contentEncoding}` : filePath;
}

/**
 * Pick the on-disk body to send: prefer Vite's `*.gz` sibling when the client
 * accepts gzip. Content-Type always reflects the logical (uncompressed) path.
 */
async function resolveBodyFile(
  req: IncomingMessage,
  logicalPath: string,
): Promise<{ bodyPath: string; contentEncoding?: 'gzip' }> {
  if (!clientAcceptsGzip(req) || !isGzipEligiblePath(logicalPath)) {
    return { bodyPath: logicalPath };
  }

  const gzPath = gzipSiblingPath(logicalPath);
  if (await fileExists(gzPath)) {
    return { bodyPath: gzPath, contentEncoding: 'gzip' };
  }

  return { bodyPath: logicalPath };
}

export async function serveFile(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
): Promise<void> {
  const { bodyPath, contentEncoding } = await resolveBodyFile(req, filePath);
  const stat = await fs.stat(bodyPath);

  setSecurityHeaders(res);
  // ETag the bytes we actually send (raw or precompressed).
  const etag = `W/"${stat.size}-${stat.mtimeMs}${contentEncoding ? '-gzip' : ''}"`;
  res.setHeader('ETag', etag);
  res.setHeader('Last-Modified', stat.mtime.toUTCString());

  // Caches must vary on Accept-Encoding whenever a .gz sibling may be chosen.
  if (isGzipEligiblePath(filePath)) {
    res.setHeader('Vary', 'Accept-Encoding');
  }

  const ifNoneMatchRaw = req.headers['if-none-match'];
  const ifNoneMatch = typeof ifNoneMatchRaw === 'string' ? ifNoneMatchRaw : '';
  const ifNoneMatchList = ifNoneMatch
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (ifNoneMatchList.includes(etag)) {
    res.statusCode = 304;
    const cacheControl = cacheControlFor(filePath);
    if (cacheControl) res.setHeader('Cache-Control', cacheControl);
    res.end();
    return;
  }

  const ifModifiedSinceRaw = req.headers['if-modified-since'];
  const ifModifiedSince =
    typeof ifModifiedSinceRaw === 'string' ? Date.parse(ifModifiedSinceRaw) : NaN;
  if (Number.isFinite(ifModifiedSince) && stat.mtimeMs <= ifModifiedSince) {
    res.statusCode = 304;
    const cacheControl = cacheControlFor(filePath);
    if (cacheControl) res.setHeader('Cache-Control', cacheControl);
    res.end();
    return;
  }

  const cacheKey = cacheKeyFor(bodyPath, contentEncoding);
  const cached: CachedStaticFile | undefined = fileCache.get(cacheKey);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    res.statusCode = 200;
    res.setHeader('Content-Type', cached.contentType);
    if (cached.contentEncoding) res.setHeader('Content-Encoding', cached.contentEncoding);
    if (cached.cacheControl) res.setHeader('Cache-Control', cached.cacheControl);
    res.end(cached.data);
    return;
  }

  const data = await fs.readFile(bodyPath);
  res.statusCode = 200;
  // Content-Type from the logical path (e.g. .js), not from .js.gz.
  const contentType = contentTypeFor(filePath);
  res.setHeader('Content-Type', contentType);
  if (contentEncoding) res.setHeader('Content-Encoding', contentEncoding);
  const cacheControl = cacheControlFor(filePath);
  if (cacheControl) res.setHeader('Cache-Control', cacheControl);
  res.end(data);

  if (cacheControl) {
    const cacheEntry: CachedStaticFile = {
      mtimeMs: stat.mtimeMs,
      data,
      contentType,
      cacheControl,
      contentEncoding,
    };

    fileCache.set(cacheKey, cacheEntry);
  }
}
