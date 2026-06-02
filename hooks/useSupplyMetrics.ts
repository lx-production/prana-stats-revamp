import { useMemo } from 'react';
import { useBondStats } from './useBondStats';
import { useTopHoldingAddresses } from './useTopHoldingAddresses';
import { computeSupplyMetrics } from '../utils/supplyMetrics';
import type { SupplyMetricsData } from '../types/supplyMetrics.types';

export function useSupplyMetrics(): SupplyMetricsData {
  const { holders, isLoading: isTopHoldingsLoading, error: topHoldingsError } = useTopHoldingAddresses();
  const {
    buyBondCapacityDisplay,
    isLoading: isBondStatsLoading,
    error: bondStatsError,
  } = useBondStats();

  const { circulatingSupply, buyableSupply } = useMemo(
    () => computeSupplyMetrics(holders, buyBondCapacityDisplay),
    [holders, buyBondCapacityDisplay],
  );

  return {
    circulatingSupply,
    buyableSupply,
    isCirculatingSupplyLoading: isTopHoldingsLoading,
    isBuyableSupplyLoading: isTopHoldingsLoading || isBondStatsLoading,
    error: topHoldingsError ?? bondStatsError,
  };
}
