import type { Buffer } from 'node:buffer';

export interface CachedStaticFile {
  mtimeMs: number;
  data: Buffer;
  contentType: string;
  cacheControl: string;
  /** Set when the cached body is a Vite-precompressed `.gz` sibling. */
  contentEncoding?: 'gzip';}

export type StaticFileCache = Map<string, CachedStaticFile>;
