import type { BondStatsComputed, BondStatsData } from '../types';
import { useCallback, useEffect, useState } from 'react';
import { initialBondStats } from '../constants/bondStats';
import { getCachedBondMetricsApi, fetchBondMetricsApi } from '../utils/bondMetricsApi';

const toLoadedStats = (computed: BondStatsComputed): BondStatsData => ({
  ...initialBondStats,
  ...computed,
  isLoading: false,
  error: null,
});

function getCachedBondSummary(): BondStatsComputed | null {
  const bondMetrics = getCachedBondMetricsApi();
  return bondMetrics?.summary ?? null;
}

export function useBondStats() {
  const [stats, setStats] = useState<BondStatsData>(() => {
    const cached = getCachedBondSummary();
    return cached ? toLoadedStats(cached) : initialBondStats;
  });

  const fetchData = useCallback(async () => {
    const cached = getCachedBondSummary();
    if (cached) {
      setStats(toLoadedStats(cached));
      return;
    }

    try {
      const response = await fetchBondMetricsApi();
      if (response.summary) {
        setStats(toLoadedStats(response.summary));
        return;
      }
    } catch {
      // Preserve the more specific error below.
    }

    setStats(prev => ({
      ...prev,
      isLoading: false,
      error: 'Failed to fetch bond stats',
    }));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return stats;
}
