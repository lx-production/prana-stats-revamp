import { useMemo } from 'react';
import { useBondStats } from './useBondStats';
import { useTopHoldingAddresses } from './useTopHoldingAddresses';
import type { SupplyMetricsData } from '../types/supplyMetrics.types';

const TOTAL_SUPPLY = 10_000_000;
const NON_CIRCULATING_RANKS = new Set([1, 2, 3, 5]);
const BUYABLE_LABELS = new Set(['WBTC/PRANA DEX Pool', 'DEX Pool & Bonds Reserve']);

const toFiniteNumber = (value: unknown): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export function useSupplyMetrics(): SupplyMetricsData {
  const { holders, isLoading: isTopHoldingsLoading, error: topHoldingsError } = useTopHoldingAddresses();
  const {
    buyBondCapacityDisplay,
    isLoading: isBondStatsLoading,
    error: bondStatsError,
  } = useBondStats();

  const circulatingSupply = useMemo(() => {
    const nonCirculating = holders.reduce((sum, holder, index) => {
      const rank = index + 1;
      if (!NON_CIRCULATING_RANKS.has(rank)) return sum;
      return sum + toFiniteNumber(holder.balance);
    }, 0);

    const remaining = TOTAL_SUPPLY - nonCirculating;
    return Number.isFinite(remaining) ? Math.max(0, remaining) : 0;
  }, [holders]);

  const buyableSupply = useMemo(() => {
    const poolTotal = holders.reduce((sum, holder) => {
      if (!BUYABLE_LABELS.has(holder.label)) return sum;
      return sum + toFiniteNumber(holder.balance);
    }, 0);

    const capacityPranaRaw = typeof buyBondCapacityDisplay === 'string'
      ? Number(buyBondCapacityDisplay.replace(/,/g, ''))
      : 0;

    const capacityPrana = Number.isFinite(capacityPranaRaw) ? capacityPranaRaw : 0;
    const total = poolTotal + capacityPrana;
    return Number.isFinite(total) ? total : 0;
  }, [holders, buyBondCapacityDisplay]);

  return {
    circulatingSupply,
    buyableSupply,
    isCirculatingSupplyLoading: isTopHoldingsLoading,
    isBuyableSupplyLoading: isTopHoldingsLoading || isBondStatsLoading,
    error: topHoldingsError ?? bondStatsError,
  };
}
