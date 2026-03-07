import { useState, useEffect, useCallback } from 'react';
import { initialPranaStats } from '../constants/pranaStats';
import { fetchJson } from '../utils/fetchJson';
import type { PranaStatsApiResponse } from '../types/api.types';
import type { PranaStatsData, PranaStatsComputed } from '../types';

let sharedComputedCache: PranaStatsComputed | null = null;
let sharedInFlight: Promise<PranaStatsComputed> | null = null;

const fetchPranaStats = async (): Promise<PranaStatsComputed> => {
  return await fetchJson<PranaStatsApiResponse>('/api/prana-stats');
};

const getSharedPranaStats = async (): Promise<PranaStatsComputed> => {
  if (sharedComputedCache) return sharedComputedCache;

  if (!sharedInFlight) {
    sharedInFlight = fetchPranaStats()
      .then((computed) => {
        sharedComputedCache = computed;
        return computed;
      })
      .finally(() => {
        sharedInFlight = null;
      });
  }

  return await sharedInFlight;
};

const toLoadedStats = (computed: PranaStatsComputed): PranaStatsData => ({
  ...initialPranaStats,
  ...computed,
  isLoading: false,
  error: null,
});


export function usePranaStats() {
  const [stats, setStats] = useState<PranaStatsData>(() =>
    sharedComputedCache ? toLoadedStats(sharedComputedCache) : initialPranaStats
  );

  const fetchData = useCallback(async () => {
    if (sharedComputedCache) {
      setStats(toLoadedStats(sharedComputedCache));
      return;
    }

    try {
      const computed = await getSharedPranaStats();
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
