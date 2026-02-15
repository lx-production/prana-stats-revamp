import { fetchJson } from './fetchJson';

const TOP_HOLDING_ADDRESSES_JSON_TTL_MS = 30_000; // 30 seconds

let cached: { value: unknown; timestamp: number } | null = null;

export function getTopHoldingAddressesJsonUrl(force = false) {
  if (!force) return '/top_holding_addresses.json';
  return `/top_holding_addresses.json?t=${Date.now()}`;
}

async function fetchTopHoldingAddressesJsonCached<T = unknown>(opts: { force?: boolean } = {}): Promise<T> {
  const force = opts.force === true;
  const now = Date.now();

  if (!force && cached && now - cached.timestamp < TOP_HOLDING_ADDRESSES_JSON_TTL_MS) {
    return cached.value as T;
  }

  const value = await fetchJson<T>(getTopHoldingAddressesJsonUrl(force), undefined, {
    dedupeKey: force ? null : undefined,
  });
  cached = { value, timestamp: Date.now() };
  return value;
}

export async function fetchTopHoldingAddressesJsonSafe<T>(fallback: T, opts: { force?: boolean } = {}): Promise<T> {
  try {
    return await fetchTopHoldingAddressesJsonCached<T>(opts);
  } catch (e) {
    console.warn('Failed to fetch top_holding_addresses.json', e);
    return fallback;
  }
}

