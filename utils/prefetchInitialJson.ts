import { fetchPranaStatsApi } from './pranaStatsApi.ts';

let hasPrefetchedInitialJson = false;

export function prefetchInitialJson() {
  if (hasPrefetchedInitialJson) return;
  hasPrefetchedInitialJson = true;

  // Warm /api/prana-stats before hooks mount (shared by usePranaStats / usePranaPrices).
  void fetchPranaStatsApi();
}
