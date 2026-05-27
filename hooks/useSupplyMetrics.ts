import { useMemo } from 'react';
import { useBondStats } from './useBondStats';
import { useCapital } from './useCapital';
import { usePranaPrices } from './usePranaPrices';
import { useTopHoldingAddresses } from './useTopHoldingAddresses';
import type { SupplyMetricsData } from '../types/supplyMetrics.types';

const TOTAL_SUPPLY = 10_000_000;
const SATS_PER_BTC = 100_000_000;
const NON_CIRCULATING_RANKS = new Set([1, 2, 3, 5]);
const BUYABLE_LABELS = new Set(['WBTC/PRANA DEX Pool', 'DEX Pool & Bonds Reserve']);
const DEX_POOL_LABEL = 'WBTC/PRANA DEX Pool';
const DEX_POOL_WBTC_CAPITAL_ID = 'wbtc-prana-pool';

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
  const { items, isLoading: isCapitalLoading, error: capitalError } = useCapital();
  const {
    btcPriceUsd,
    latestSatPrice,
    isLoading: isPricesLoading,
    error: pricesError,
  } = usePranaPrices();

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

  const dexPoolPranaAmount = useMemo(() => {
    const dexPoolHolder = holders.find((holder) => holder.label === DEX_POOL_LABEL);
    return toFiniteNumber(dexPoolHolder?.balance);
  }, [holders]);

  const dexPoolWbtcUsdValue = useMemo(() => {
    const dexPoolWbtcItem = items.find((item) => item.id === DEX_POOL_WBTC_CAPITAL_ID);
    return typeof dexPoolWbtcItem?.usdValueNumber === 'number' && Number.isFinite(dexPoolWbtcItem.usdValueNumber)
      ? dexPoolWbtcItem.usdValueNumber
      : 0;
  }, [items]);

  const liquidityValues = useMemo(() => {
    if (
      typeof btcPriceUsd !== 'number' ||
      typeof latestSatPrice !== 'number' ||
      !Number.isFinite(btcPriceUsd) ||
      !Number.isFinite(latestSatPrice) ||
      btcPriceUsd <= 0 ||
      latestSatPrice <= 0 ||
      circulatingSupply <= 0
    ) {
      return {
        liquidityDensityPercent: null,
        liquidityUsd: null,
      };
    }

    const pranaUsdPrice = (latestSatPrice / SATS_PER_BTC) * btcPriceUsd;
    const dexPoolPranaUsdValue = dexPoolPranaAmount * pranaUsdPrice;
    const liquidityUsd = dexPoolWbtcUsdValue + dexPoolPranaUsdValue;
    const circulatingMarketCapUsd = circulatingSupply * pranaUsdPrice;
    const liquidityDensityPercent = circulatingMarketCapUsd > 0
      ? (liquidityUsd / circulatingMarketCapUsd) * 100
      : null;

    return {
      liquidityDensityPercent: liquidityDensityPercent !== null && Number.isFinite(liquidityDensityPercent)
        ? liquidityDensityPercent
        : null,
      liquidityUsd: Number.isFinite(liquidityUsd) ? liquidityUsd : null,
    };
  }, [btcPriceUsd, circulatingSupply, dexPoolPranaAmount, dexPoolWbtcUsdValue, latestSatPrice]);

  return {
    circulatingSupply,
    buyableSupply,
    liquidityDensityPercent: liquidityValues.liquidityDensityPercent,
    liquidityUsd: liquidityValues.liquidityUsd,
    isCirculatingSupplyLoading: isTopHoldingsLoading,
    isBuyableSupplyLoading: isTopHoldingsLoading || isBondStatsLoading,
    isLiquidityDensityLoading: isTopHoldingsLoading || isCapitalLoading || isPricesLoading,
    error: topHoldingsError ?? capitalError ?? pricesError ?? bondStatsError,
  };
}
