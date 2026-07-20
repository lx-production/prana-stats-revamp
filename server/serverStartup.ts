import { summaryCache } from './getApiRoutes.ts';
import { loadSummaryMarkdown } from './loaders/summary.ts';
import { loadCachedLpCapital } from './loaders/cached/lpCapitalCached.ts';
import { loadCachedBondMetrics } from './loaders/cached/bondMetricsCached.ts';
import { loadCachedStakingStats } from './loaders/cached/stakingStatsCached.ts';
import { loadCachedStakingConfig } from './loaders/cached/stakingConfigCached.ts';
import { formatErrorForLog } from './helpers/logRedaction.ts';

export async function warmApiCaches() {
  const warmups = [
    { name: '/api/summary', load: () => summaryCache(() => loadSummaryMarkdown()) },
    { name: '/api/staking-stats', load: () => loadCachedStakingStats() },
    { name: '/api/staking/config', load: () => loadCachedStakingConfig() },
    { name: '/api/lp-capital', load: () => loadCachedLpCapital() },
    { name: '/api/bond-metrics', load: () => loadCachedBondMetrics() },
  ];

  console.log('Warming API caches...');

  const results = await Promise.allSettled(warmups.map((warmup) => warmup.load()));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn(
        `Failed to warm ${warmups[index].name}:`,
        formatErrorForLog(result.reason),
      );
    }
  });

  console.log('API cache warming finished.');
}
