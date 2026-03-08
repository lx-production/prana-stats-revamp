import { updateBondsV2 } from '../scripts/update-bonds-v2.ts';
import { updateTopHoldingAddresses } from '../scripts/update-top-holding-addresses.ts';
import type { UpdateBondsV2Result } from './types/indexTypes.ts';
import type { UpdateTopHoldingAddressesResult } from '../scripts/types/updateTopHoldingAddressesTypes.ts';

// Tracks in-flight refresh requests to avoid multiple concurrent calls.
let refreshInFlight: Promise<UpdateBondsV2Result> | null = null;
let bondsLastRefreshAt = 0;
let bondsLastResult: UpdateBondsV2Result | null = null;
const BONDS_REFRESH_TTL_MS = 30_000; // 30 seconds

let topHoldingRefreshInFlight: Promise<UpdateTopHoldingAddressesResult> | null = null;
let topHoldingLastRefreshAt = 0;
let topHoldingLastResult: UpdateTopHoldingAddressesResult | null = null;
const TOP_HOLDING_REFRESH_TTL_MS = 30_000;

type CachedValue<T> = {
  value: T;
  timestamp: number;
};

const API_CACHE_TTL_MS = 30_000;

export async function ensureBondsRefreshed(): Promise<UpdateBondsV2Result> {
  const now = Date.now();
  if (bondsLastResult && now - bondsLastRefreshAt < BONDS_REFRESH_TTL_MS) {
    return bondsLastResult;
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const result = await updateBondsV2();
        bondsLastResult = result;
        bondsLastRefreshAt = Date.now();
        return result;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  const result = await refreshInFlight;
  bondsLastResult = result;
  bondsLastRefreshAt = Date.now();
  return result;
}

export async function ensureHoldingsRefreshed(): Promise<UpdateTopHoldingAddressesResult> {
  const now = Date.now();
  if (topHoldingLastResult && now - topHoldingLastRefreshAt < TOP_HOLDING_REFRESH_TTL_MS) {
    return topHoldingLastResult;
  }

  if (!topHoldingRefreshInFlight) {
    topHoldingRefreshInFlight = (async () => {
      try {
        const result = await updateTopHoldingAddresses();
        topHoldingLastResult = result;
        topHoldingLastRefreshAt = Date.now();
        return result;
      } finally {
        topHoldingRefreshInFlight = null;
      }
    })();
  }

  const result = await topHoldingRefreshInFlight;
  topHoldingLastResult = result;
  topHoldingLastRefreshAt = Date.now();
  return result;
}

export async function getCachedApiValue<T>(
  cache: CachedValue<T> | null,
  inFlight: Promise<T> | null,
  loader: () => Promise<T>,
  setCache: (value: CachedValue<T> | null) => void,
  setInFlight: (value: Promise<T> | null) => void,
): Promise<T> {
  const now = Date.now();
  if (cache && now - cache.timestamp < API_CACHE_TTL_MS) {
    return cache.value;
  }

  if (!inFlight) {
    const nextPromise = (async () => {
      try {
        const value = await loader();
        setCache({ value, timestamp: Date.now() });
        return value;
      } finally {
        setInFlight(null);
      }
    })();
    setInFlight(nextPromise);
    inFlight = nextPromise;
  }

  return await inFlight;
}

export type { CachedValue };