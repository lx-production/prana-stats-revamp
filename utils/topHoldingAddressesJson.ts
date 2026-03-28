import { fetchJsonSafe } from './fetchJson.ts';

// Default URL allows browser caching based on server cache headers.
// When `force` is true, append a one-off cache-buster to fetch the latest file.
export function getTopHoldingAddressesJsonUrl(force = false) {
  if (!force) return '/top_holding_addresses.json';
  return `/top_holding_addresses.json?t=${Date.now()}`;
}

export async function fetchTopHoldingAddressesJsonSafe<T>(fallback: T, opts: { force?: boolean } = {}): Promise<T> {
  return await fetchJsonSafe<T>(getTopHoldingAddressesJsonUrl(opts.force === true), fallback);
}
