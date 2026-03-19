import { updateBondsV2 } from '../scripts/update-bonds-v2.ts';
import { updateTopHoldingAddresses } from '../scripts/update-top-holding-addresses.ts';
import { CACHE_TTL_MS } from '../constants/cachePolicy.js';

export function createServerCache<T>(ttlMs: number) {
  let cached: { value: T; timestamp: number } | null = null;
  let inFlight: Promise<T> | null = null;

  return async function get(loader: () => Promise<T>): Promise<T> {
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      return cached.value;
    }

    if (!inFlight) {
      inFlight = (async () => {
        try {
          const value = await loader();
          cached = { value, timestamp: Date.now() };
          return value;
        } finally {
          inFlight = null;
        }
      })();
    }

    return await inFlight;
  };
}

export const bondsRefreshCache = createServerCache(CACHE_TTL_MS.bondsRefresh);
export const holdingsRefreshCache = createServerCache(CACHE_TTL_MS.topHoldingsRefresh);

export const ensureBondsRefreshed = () => bondsRefreshCache(updateBondsV2);
export const ensureHoldingsRefreshed = () => holdingsRefreshCache(updateTopHoldingAddresses);
