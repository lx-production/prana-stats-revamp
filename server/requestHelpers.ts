import fs from 'node:fs/promises';
import type { ServerResponse } from 'node:http';

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

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  options: SendJsonOptions = {},
): void {
  res.statusCode = statusCode;
  res.setHeader('Cache-Control', options.cacheControl ?? 'no-cache');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
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

export function rootTopHoldingAddressesFilenameFromPathname(pathname: string): string | null {
  if (pathname !== '/top_holding_addresses.json') return null;
  return 'top_holding_addresses.json';
}

export function rootBuyDipsFilenameFromPathname(pathname: string): string | null {
  if (pathname !== '/buy_dips.json') return null;
  return 'buy_dips.json';
}
