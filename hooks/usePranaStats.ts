import type { PranaStatsData } from '../types';
import type { PranaStatsApiResponse } from '../types/api.types';
import { useState, useEffect, useCallback } from 'react';
import { initialPranaStats } from '../constants/pranaStats';
import { fetchPranaStatsApi, getCachedPranaStatsApi } from '../utils/pranaStatsApi';

const toLoadedStats = (computed: PranaStatsApiResponse): PranaStatsData => ({
  ...initialPranaStats,
  ...computed,
  isLoading: false,
  error: null,
});


export function usePranaStats() {
  const [stats, setStats] = useState<PranaStatsData>(() => {
    const cached = getCachedPranaStatsApi();
    return cached ? toLoadedStats(cached) : initialPranaStats;
  });

  const fetchData = useCallback(async () => {
    const cached = getCachedPranaStatsApi();
    if (cached) {
      setStats(toLoadedStats(cached));
      return;
    }

    try {
      const computed = await fetchPranaStatsApi();
      setStats(toLoadedStats(computed));

    } catch (err: any) {
      console.error("Failed to fetch Prana stats:", err);
      const message =
        typeof err?.message === 'string' && err.message.trim().length > 0
          ? err.message
          : 'Failed to fetch Prana stats';
      setStats(prev => ({ ...prev, isLoading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return stats;
}
