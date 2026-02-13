import type { Buffer } from 'node:buffer';

export interface CachedStaticFile {
  mtimeMs: number;
  data: Buffer;
  contentType: string;
  cacheControl: string;
}

export type StaticFileCache = Map<string, CachedStaticFile>;
