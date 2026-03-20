import { useCallback, useEffect, useState } from 'react';
import { initialStakingStats } from '../constants/stakingStats';
import type { StakingStatsComputed, StakingStatsData } from '../types';
import { fetchStakingStatsApi, getCachedStakingStatsApi } from '../utils/stakingStatsApi';

const toLoadedStats = (computed: StakingStatsComputed): StakingStatsData => ({
  ...initialStakingStats,
  ...computed,
  isLoading: false,
  error: null,
});

export function useStakingStats() {
  const [stats, setStats] = useState<StakingStatsData>(() => {
    const cached = getCachedStakingStatsApi();
    return cached ? toLoadedStats(cached) : initialStakingStats;
  });

  const fetchData = useCallback(async () => {
    const cached = getCachedStakingStatsApi();
    if (cached) {
      setStats(toLoadedStats(cached));
      return;
    }

    try {
      const computed = await fetchStakingStatsApi();
      setStats(toLoadedStats(computed));
    } catch (err: any) {
      console.error('Failed to fetch staking stats:', err);
      const message =
        typeof err?.message === 'string' && err.message.trim().length > 0
          ? err.message
          : 'Failed to fetch staking stats';
      setStats(prev => ({ ...prev, isLoading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return stats;
}
