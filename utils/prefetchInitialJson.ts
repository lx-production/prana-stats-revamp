import { fetchBondMetricsApi } from './bondMetricsApi.ts';
import { fetchPranaStatsApi } from './pranaStatsApi.ts';

let hasPrefetchedInitialJson = false;

export function prefetchInitialJson() {
  if (hasPrefetchedInitialJson) return;
  hasPrefetchedInitialJson = true;

  void Promise.allSettled([
    // Warm shared API responses used by multiple hooks.
    fetchPranaStatsApi(),
    fetchBondMetricsApi(),
  ]);
}
