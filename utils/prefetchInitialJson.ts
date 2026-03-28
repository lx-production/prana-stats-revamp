import { fetchBuyDipsJsonSafe } from './buyDipsJson.ts';
import { fetchBondMetricsApi } from './bondMetricsApi.ts';
import { fetchBondsV2TotalsSafe } from './bondsV2Json.ts';
import { fetchJsonSafe } from './fetchJson.ts';
import { fetchPranaStatsApi } from './pranaStatsApi.ts';

const fallbackBuyDipsJson = {};

let hasPrefetchedInitialJson = false;

export function prefetchInitialJson() {
  if (hasPrefetchedInitialJson) return;
  hasPrefetchedInitialJson = true;

  const refreshBondsThenPrefetchJson = (async () => {
    const refreshResult = await fetchJsonSafe<{ updated?: boolean }>('/api/bonds-v2/refresh-bonds', {});
    await fetchBondsV2TotalsSafe({
      force: Boolean(refreshResult?.updated),
    });
  })();

  void Promise.allSettled([
    // Warm browser cache helpers used by multiple hooks.
    fetchPranaStatsApi(),
    fetchBondMetricsApi(),

    // Warm API endpoints used directly by hooks.
    fetchJsonSafe('/api/capital', {}),
    fetchJsonSafe('/api/lp-capital', {}),

    // Warm root JSON files.
    fetchBuyDipsJsonSafe(fallbackBuyDipsJson),

    // Refresh-dependent warmups to avoid stale values.
    refreshBondsThenPrefetchJson,
  ]);
}
