import { fetchJson, fetchJsonSafe } from './fetchJson.ts';

export function getBuyDipsJsonUrl(force = false) {
  if (!force) return '/buy_dips.json';
  return `/buy_dips.json?t=${Date.now()}`;
}

export async function fetchBuyDipsJson<T>(opts: { force?: boolean } = {}): Promise<T> {
  return await fetchJson<T>(getBuyDipsJsonUrl(opts.force === true));
}
