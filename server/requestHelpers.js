import fs from 'node:fs/promises';

export async function fileExists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

export function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function rootDataJsonFilenameFromPathname(pathname) {
  if (!pathname.startsWith('/data_') || !pathname.endsWith('.json')) return null;
  const filename = pathname.slice(1); // remove the leading slash
  if (filename.includes('/')) return null; // only allow direct files in project root (no nested paths)
  return filename;
}

export function rootBondsJsonFilenameFromPathname(pathname) {
  if (pathname !== '/bonds_v2.json') return null;
  return 'bonds_v2.json';
}

export function rootTopHoldingAddressesFilenameFromPathname(pathname) {
  if (pathname !== '/top_holding_addresses.json') return null;
  return 'top_holding_addresses.json';
}
