import { fetchJson } from './fetchJson';
import { PAGE_LOAD_CACHE_BUST } from './pageLoadCacheBust';

// Keep this small: the goal is to dedupe requests on page load,
// not to keep the bonds data stale for long periods.
const BONDS_V2_JSON_TTL_MS = 15_000;

let cached: { value: unknown; timestamp: number } | null = null;
let inFlight: Promise<unknown> | null = null;

export function getBondsV2JsonUrl() {
  // Cache-buster prevents stale browser/proxy caching when the JSON might have been refreshed.
  return `/bonds_v2.json?t=${PAGE_LOAD_CACHE_BUST}`;
}

export async function fetchBondsV2Json<T = unknown>(opts: { force?: boolean } = {}): Promise<T> {
  const force = opts.force === true;
  const now = Date.now();

  if (!force && cached && now - cached.timestamp < BONDS_V2_JSON_TTL_MS) {
    return cached.value as T;
  }

  // If a request is already in-flight and we aren't forcing,
  // reuse it to dedupe concurrent callers.
  if (!force && inFlight) return (await inFlight) as T;

  inFlight = (async () => {
    const value = await fetchJson<T>(getBondsV2JsonUrl());
    cached = { value, timestamp: Date.now() };
    return value;
  })().finally(() => {
    inFlight = null;
  });

  return (await inFlight) as T;
}

export async function fetchBondsV2JsonSafe<T>(fallback: T, opts: { force?: boolean } = {}): Promise<T> {
  try {
    return await fetchBondsV2Json<T>(opts);
  } catch (e) {
    console.warn('Failed to fetch bonds_v2.json', e);
    return fallback;
  }
}

