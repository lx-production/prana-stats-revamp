import { useCallback, useEffect, useState } from 'react';
import { initialBondStats } from '../constants/bondStats';
import type { BondStatsComputed, BondStatsData } from '../types';
import { getCachedBondMetricsApi, fetchBondMetricsApi } from '../utils/bondMetricsApi';
import { fetchPranaStatsApi, getCachedPranaStatsApi } from '../utils/pranaStatsApi';

const toLoadedStats = (computed: BondStatsComputed): BondStatsData => ({
  ...initialBondStats,
  ...computed,
  isLoading: false,
  error: null,
});

type LegacyPranaStatsWithBonds = Partial<BondStatsComputed>;

function toBondStatsResponse(legacy: LegacyPranaStatsWithBonds | null | undefined): BondStatsComputed | null {
  if (!legacy) return null;

  if (
    typeof legacy.buyBondPrana !== 'number' ||
    typeof legacy.buyBondVnd !== 'number' ||
    typeof legacy.sellBondPrana !== 'number' ||
    typeof legacy.sellBondVnd !== 'number' ||
    typeof legacy.buyBondBalanceDisplay !== 'string' ||
    typeof legacy.buyBondCommittedDisplay !== 'string' ||
    typeof legacy.buyBondCapacityDisplay !== 'string' ||
    typeof legacy.buyBondCommittedPercent !== 'number' ||
    typeof legacy.buyBondCapacityPercent !== 'number' ||
    typeof legacy.sellBondBalanceDisplay !== 'string' ||
    typeof legacy.sellBondCommittedDisplay !== 'string' ||
    typeof legacy.sellBondCapacityDisplay !== 'string' ||
    typeof legacy.sellBondCommittedPercent !== 'number' ||
    typeof legacy.sellBondCapacityPercent !== 'number'
  ) {
    return null;
  }

  return {
    buyBondPrana: legacy.buyBondPrana,
    buyBondVnd: legacy.buyBondVnd,
    sellBondPrana: legacy.sellBondPrana,
    sellBondVnd: legacy.sellBondVnd,
    buyBondBalanceDisplay: legacy.buyBondBalanceDisplay,
    buyBondCommittedDisplay: legacy.buyBondCommittedDisplay,
    buyBondCapacityDisplay: legacy.buyBondCapacityDisplay,
    buyBondCommittedPercent: legacy.buyBondCommittedPercent,
    buyBondCapacityPercent: legacy.buyBondCapacityPercent,
    sellBondBalanceDisplay: legacy.sellBondBalanceDisplay,
    sellBondCommittedDisplay: legacy.sellBondCommittedDisplay,
    sellBondCapacityDisplay: legacy.sellBondCapacityDisplay,
    sellBondCommittedPercent: legacy.sellBondCommittedPercent,
    sellBondCapacityPercent: legacy.sellBondCapacityPercent,
  };
}

function getCachedBondSummary(): BondStatsComputed | null {
  const bondMetrics = getCachedBondMetricsApi();
  if (bondMetrics?.summary) {
    return bondMetrics.summary;
  }

  return toBondStatsResponse(getCachedPranaStatsApi() as LegacyPranaStatsWithBonds | null);
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
      // Fall through to legacy /api/prana-stats.
    }

    try {
      const legacy = await fetchPranaStatsApi();
      const summary = toBondStatsResponse(legacy as LegacyPranaStatsWithBonds);
      if (summary) {
        setStats(toLoadedStats(summary));
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
