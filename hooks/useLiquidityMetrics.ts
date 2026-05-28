import { useMemo } from 'react';
import { useArbitrumWbtcUsdtLpValue } from './useArbitrumWbtcUsdtLpValue';
import { useCapital } from './useCapital';
import { usePranaPrices } from './usePranaPrices';
import { useTopHoldingAddresses } from './useTopHoldingAddresses';
import type { LiquidityMetricsData } from '../types/liquidityMetrics.types';

const TOTAL_SUPPLY = 10_000_000;
const SATS_PER_BTC = 100_000_000;
const NON_CIRCULATING_RANKS = new Set([1, 2, 3, 5]);
const DEX_POOL_LABEL = 'WBTC/PRANA DEX Pool';
const DEX_POOL_WBTC_CAPITAL_ID = 'wbtc-prana-pool';

const toFiniteNumber = (value: unknown): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export function useLiquidityMetrics(): LiquidityMetricsData {
  const { holders, isLoading: isTopHoldingsLoading, error: topHoldingsError } = useTopHoldingAddresses();
  const { items, isLoading: isCapitalLoading, error: capitalError } = useCapital();
  const {
    usdValueNumber: lpUsdValueNumber,
    isLoading: isLpLoading,
    error: lpError,
  } = useArbitrumWbtcUsdtLpValue();
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

  const protocolCapitalUsd = useMemo(() => {
    const capitalTotal = items.reduce((sum, item) => {
      if (item.tokenSymbol === 'USDT') {
        return sum + toFiniteNumber(item.amountValue);
      }

      if (item.tokenSymbol === 'WBTC') {
        return sum + toFiniteNumber(item.usdValueNumber);
      }

      return sum;
    }, 0);

    return capitalTotal + toFiniteNumber(lpUsdValueNumber);
  }, [items, lpUsdValueNumber]);

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
        protocolCapitalCoveragePercent: null,
      };
    }

    const pranaUsdPrice = (latestSatPrice / SATS_PER_BTC) * btcPriceUsd;
    const circulatingMarketCapUsd = circulatingSupply * pranaUsdPrice;
    const dexPoolPranaUsdValue = dexPoolPranaAmount * pranaUsdPrice;
    const liquidityUsd = dexPoolWbtcUsdValue + dexPoolPranaUsdValue;

    return {
      liquidityDensityPercent: circulatingMarketCapUsd > 0 && Number.isFinite(liquidityUsd)
        ? (liquidityUsd / circulatingMarketCapUsd) * 100
        : null,
      protocolCapitalCoveragePercent: circulatingMarketCapUsd > 0 && Number.isFinite(protocolCapitalUsd)
        ? (protocolCapitalUsd / circulatingMarketCapUsd) * 100
        : null,
    };
  }, [
    btcPriceUsd,
    circulatingSupply,
    dexPoolPranaAmount,
    dexPoolWbtcUsdValue,
    latestSatPrice,
    protocolCapitalUsd,
  ]);

  return {
    liquidityDensityPercent: Number.isFinite(liquidityValues.liquidityDensityPercent)
      ? liquidityValues.liquidityDensityPercent
      : null,
    protocolCapitalCoveragePercent: Number.isFinite(liquidityValues.protocolCapitalCoveragePercent)
      ? liquidityValues.protocolCapitalCoveragePercent
      : null,
    isLiquidityDensityLoading: isTopHoldingsLoading || isCapitalLoading || isPricesLoading,
    isProtocolCapitalCoverageLoading: isTopHoldingsLoading || isCapitalLoading || isLpLoading || isPricesLoading,
    error: topHoldingsError ?? capitalError ?? lpError ?? pricesError,
  };
}
