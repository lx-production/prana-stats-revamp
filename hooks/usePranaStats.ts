import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { initialPranaStats } from '../constants/pranaStats';
import { fetchPranaPricesBundle } from '../utils/pranaPrices';
import { getPolygonProvider } from '../utils/polygonProvider';
import { calcChange, getFirstPrice } from '../utils/pranaStatsUtils';
import { useBondingStats } from './useBondingStats';
import { useStakingStats } from './useStakingStats';
import { FetchBondingStats, FetchStakingStats, PranaStatsData, PranaStatsComputed } from '../types';

const ATL_PRICE = 0.0017; // From scripts.js

const fetchPranaStats = async (
  getProvider: () => ethers.JsonRpcProvider,
  fetchBondingStats: FetchBondingStats,
  fetchStakingStats: FetchStakingStats
): Promise<PranaStatsComputed> => {
  const provider = getProvider();

  const { btcPriceUsd, btcPriceVnd, usdToVndRate, latestSatPrice, d30, d90, d180, d365, bondsV2Json } = await fetchPranaPricesBundle();

  const pranaPriceVnd = (latestSatPrice / 1e8) * btcPriceVnd;
  const marketCap = Math.round(pranaPriceVnd * 1e7); // 10M Total Supply
  
  const [stakingStats, bondingStats] = await Promise.all([
    fetchStakingStats({ provider }),
    fetchBondingStats({ provider, bondsV2Json, pranaPriceVnd }),
  ]);
  
  const latestSatPriceUsd = (latestSatPrice / 1e8) * btcPriceUsd;

  // Mock historical prices relative to current to show varied percentages
  const mockM1 = latestSatPriceUsd * 0.95; // +5%
  const mockM3 = latestSatPriceUsd * 0.80; // +25%
  const mockM6 = latestSatPriceUsd * 1.20; // -16%
  const mockY1 = latestSatPriceUsd * 0.50; // +100%

  return {
    btcPriceUsd,
    btcPriceVnd,
    usdToVndRate,
    latestSatPrice,
    marketCapVnd: marketCap,
    stakedPrana: stakingStats.stakedPrana,
    stakedVnd: stakingStats.stakedPrana * pranaPriceVnd,
    interestContractBalancePrana: stakingStats.interestContractBalancePrana,
    interestContractBalanceVnd: stakingStats.interestContractBalancePrana * pranaPriceVnd,
    interestPrana: stakingStats.interestPrana,
    interestVnd: stakingStats.interestPrana * pranaPriceVnd,
    buyBondPrana: bondingStats.buyBondPrana,
    buyBondVnd: bondingStats.buyBondVnd,
    sellBondPrana: bondingStats.sellBondPrana,
    sellBondVnd: bondingStats.sellBondVnd,
    buyBondBalanceDisplay: bondingStats.buyBondBalanceDisplay,
    buyBondCommittedDisplay: bondingStats.buyBondCommittedDisplay,
    buyBondCapacityDisplay: bondingStats.buyBondCapacityDisplay,
    buyBondCommittedPercent: bondingStats.buyBondCommittedPercent,
    buyBondCapacityPercent: bondingStats.buyBondCapacityPercent,
    sellBondBalanceDisplay: bondingStats.sellBondBalanceDisplay,
    sellBondCommittedDisplay: bondingStats.sellBondCommittedDisplay,
    sellBondCapacityDisplay: bondingStats.sellBondCapacityDisplay,
    sellBondCommittedPercent: bondingStats.sellBondCommittedPercent,
    sellBondCapacityPercent: bondingStats.sellBondCapacityPercent,
    priceChange: {
      m1: calcChange(getFirstPrice(d30, mockM1), latestSatPriceUsd),
      m3: calcChange(getFirstPrice(d90, mockM3), latestSatPriceUsd),
      m6: calcChange(getFirstPrice(d180, mockM6), latestSatPriceUsd),
      y1: calcChange(getFirstPrice(d365, mockY1), latestSatPriceUsd),
      atl: calcChange(ATL_PRICE, latestSatPriceUsd),
    },
  };
};


export function usePranaStats() {
  const [stats, setStats] = useState<PranaStatsData>(initialPranaStats);
  const { fetchBondingStats } = useBondingStats();
  const { fetchStakingStats } = useStakingStats();

  const getProvider = useCallback(() => {
    return getPolygonProvider();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const computed = await fetchPranaStats(getProvider, fetchBondingStats, fetchStakingStats);

      setStats(prev => ({
        ...prev,
        ...computed,
        isLoading: false,
        error: null,
      }));

    } catch (err: any) {
      console.error("Failed to fetch Prana stats:", err);
      const message =
        typeof err?.message === 'string' && err.message.trim().length > 0
          ? err.message
          : 'Failed to fetch Prana stats';
      setStats(prev => ({ ...prev, isLoading: false, error: message }));
    }
  }, [fetchBondingStats, fetchStakingStats, getProvider]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return stats;
}
