import { loadCachedBondMetrics } from './loaders/bondMetricsCached.ts';
import { loadCachedLpCapital } from './loaders/lpCapitalCached.ts';
import { loadCachedStakingStats } from './loaders/stakingStatsCached.ts';
import { loadSummaryMarkdown } from './loaders/summary.ts';
import { summaryCache } from './getApiRoutes.ts';

export async function warmApiCaches() {
  const warmups = [
    { name: '/api/summary', load: () => summaryCache(() => loadSummaryMarkdown()) },
    { name: '/api/staking-stats', load: () => loadCachedStakingStats() },
    { name: '/api/lp-capital', load: () => loadCachedLpCapital() },
    { name: '/api/bond-metrics', load: () => loadCachedBondMetrics() },
  ];

  console.log('Warming API caches...');

  const results = await Promise.allSettled(warmups.map((warmup) => warmup.load()));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn(`Failed to warm ${warmups[index].name}:`, result.reason);
    }
  });

  console.log('API cache warming finished.');
}
