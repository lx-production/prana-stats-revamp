import fs from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { cacheControlFor } from './cacheControl.ts';
import type { CachedStaticFile, StaticFileCache } from './types/serveFileTypes.ts';

// Simple in-memory cache for static files (mostly for dist/assets/*).
// Keyed by absolute file path and invalidated when file mtime (modified time) changes.
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

export async function serveFile(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
): Promise<void> {
  const stat = await fs.stat(filePath);

  const etag = `W/"${stat.size}-${stat.mtimeMs}"`;
  res.setHeader('ETag', etag);
  res.setHeader('Last-Modified', stat.mtime.toUTCString());

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

  const cached: CachedStaticFile | undefined = fileCache.get(filePath);
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

  if (cacheControl) {
    const cacheEntry: CachedStaticFile = {
      mtimeMs: stat.mtimeMs,
      data,
      contentType,
      cacheControl,
    };

    fileCache.set(filePath, cacheEntry);
  }
}
