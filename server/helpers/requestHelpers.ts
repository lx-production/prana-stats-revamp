import fs from 'node:fs/promises';
import { setSecurityHeaders } from '../securityHeaders.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';

type SendJsonOptions = {
  cacheControl?: string;
};

type SendTextOptions = {
  cacheControl?: string;
  contentType?: string;
};

export async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

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

export function sendRedirect(
  res: ServerResponse,
  statusCode: 301 | 302 | 307 | 308,
  location: string,
): void {
  res.statusCode = statusCode;
  setSecurityHeaders(res);
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-cache');
  res.end();
}

// Used in postApiRoutes.ts for POST endpoints (swap quote, swap log, swap verify), each with its own maxBytes constant
// req is a readable stream. Data arrives in pieces (“chunks”)
export async function readJsonBody<T>(req: IncomingMessage, maxBytes = 16 * 1024): Promise<T> {
  const chunks: Buffer[] = []; // Buffer is built into Node.js
  let receivedBytes = 0;

  for await (const chunk of req) {
    // Usually each chunk is already a Node Buffer (raw bytes)
    // Sometimes it can be a string or Uint8Array
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

// gatekeeper for serving price history JSON files from the project root
// One pattern-matching helper is cleaner than listing every file separately
export function rootDataJsonFilenameFromPathname(pathname: string): string | null {
  if (!pathname.startsWith('/data_') || !pathname.endsWith('.json')) return null;
  const filename = pathname.slice(1); // remove the leading slash
  if (filename.includes('/')) return null; // only allow direct files in project root (no nested paths)
  return filename;
}
