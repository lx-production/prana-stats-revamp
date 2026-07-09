import { updateBondsV2 } from '../../scripts/update-bonds-v2.ts';

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

let bondsRefreshInFlight: Promise<Awaited<ReturnType<typeof updateBondsV2>>> | null = null;

export async function ensureBondsRefreshed() {
  if (!bondsRefreshInFlight) {
    bondsRefreshInFlight = updateBondsV2().finally(() => {
      bondsRefreshInFlight = null;
    });
  }

  return await bondsRefreshInFlight;
}
