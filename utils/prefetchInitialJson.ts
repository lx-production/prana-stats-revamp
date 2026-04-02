import { fetchBondMetricsApi } from './bondMetricsApi.ts';
import { fetchBondsV2TotalsSafe } from './bondsV2Json.ts';
import { fetchJsonSafe } from './fetchJson.ts';
import { fetchPranaStatsApi } from './pranaStatsApi.ts';

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
    // Warm shared API responses used by multiple hooks.
    fetchPranaStatsApi(),
    fetchBondMetricsApi(),

    // Refresh-dependent warmups to avoid stale values.
    refreshBondsThenPrefetchJson,
  ]);
}
