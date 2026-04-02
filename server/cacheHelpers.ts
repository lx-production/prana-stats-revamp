import { updateBondsV2 } from '../scripts/update-bonds-v2.ts';

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

export function createKeyedServerCache<TKey, TValue>(ttlMs: number) {
  const cached = new Map<TKey, { value: TValue; timestamp: number }>();
  const inFlight = new Map<TKey, Promise<TValue>>();

  return async function get(key: TKey, loader: () => Promise<TValue>): Promise<TValue> {
    const current = cached.get(key);
    if (current && Date.now() - current.timestamp < ttlMs) {
      return current.value;
    }

    const running = inFlight.get(key);
    if (running) return await running;

    const promise = (async () => {
      try {
        const value = await loader();
        cached.set(key, { value, timestamp: Date.now() });
        return value;
      } finally {
        inFlight.delete(key);
      }
    })();

    inFlight.set(key, promise);
    return await promise;
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
