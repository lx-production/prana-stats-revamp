import fs from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { setSecurityHeaders } from '../securityHeaders.ts';

export async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

type SendJsonOptions = {
  cacheControl?: string;
};

type SendTextOptions = {
  cacheControl?: string;
  contentType?: string;
};

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  options: SendJsonOptions = {},
): void {
  res.statusCode = statusCode;
  setSecurityHeaders(res);
  res.setHeader('Cache-Control', options.cacheControl ?? 'no-cache');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function sendText(
  res: ServerResponse,
  statusCode: number,
  body: string,
  options: SendTextOptions = {},
): void {
  res.statusCode = statusCode;
  setSecurityHeaders(res);
  res.setHeader('Cache-Control', options.cacheControl ?? 'no-cache');
  res.setHeader('Content-Type', options.contentType ?? 'text/plain; charset=utf-8');
  res.end(body);
}

export async function readJsonBody<T>(req: IncomingMessage, maxBytes = 16 * 1024): Promise<T> {
  const chunks: Buffer[] = [];
  let receivedBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    receivedBytes += buffer.length;

    if (receivedBytes > maxBytes) {
      throw new Error('Request body is too large.');
    }

    chunks.push(buffer);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');

  if (!rawBody.trim()) {
    throw new Error('Request body is required.');
  }

  return JSON.parse(rawBody) as T;
}

export function rootDataJsonFilenameFromPathname(pathname: string): string | null {
  if (!pathname.startsWith('/data_') || !pathname.endsWith('.json')) return null;
  const filename = pathname.slice(1); // remove the leading slash
  if (filename.includes('/')) return null; // only allow direct files in project root (no nested paths)
  return filename;
}

export function rootBondsJsonFilenameFromPathname(pathname: string): string | null {
  if (pathname !== '/bonds_v2.json') return null;
  return 'bonds_v2.json';
}

export function rootBuyDipsFilenameFromPathname(pathname: string): string | null {
  if (pathname !== '/buy_dips.json') return null;
  return 'buy_dips.json';
}
