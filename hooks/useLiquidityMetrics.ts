import { useMemo } from 'react';
import { useCapital } from './useCapital';
import { usePranaPrices } from './usePranaPrices';
import { useTopHoldingAddresses } from './useTopHoldingAddresses';
import { computeProtocolCapitalUsd } from '../utils/protocolCapital';
import { computeSupplyMetrics } from '../utils/supplyMetrics';
import { useArbitrumWbtcUsdtLpValue } from './useArbitrumWbtcUsdtLpValue';
import { computeLiquidityMetrics, getDexPoolPranaAmount, getDexPoolWbtcUsdValue } from '../utils/liquidityMetrics';
import type { LiquidityMetricsData } from '../types/liquidityMetrics.types';

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

  const circulatingSupply = useMemo(
    () => computeSupplyMetrics(holders, null).circulatingSupply,
    [holders],
  );

  const dexPoolPranaAmount = useMemo(() => getDexPoolPranaAmount(holders), [holders]);
  const dexPoolWbtcUsdValue = useMemo(() => getDexPoolWbtcUsdValue(items), [items]);

  const protocolCapitalUsd = useMemo(
    () => computeProtocolCapitalUsd(items, lpUsdValueNumber),
    [items, lpUsdValueNumber],
  );

  const { liquidityDensityPercent, protocolCapitalCoveragePercent } = useMemo(
    () => computeLiquidityMetrics({
      btcPriceUsd: btcPriceUsd ?? 0,
      latestSatPrice: latestSatPrice ?? 0,
      circulatingSupply,
      dexPoolPranaAmount,
      dexPoolWbtcUsdValue,
      protocolCapitalUsd,
    }),
    [
      btcPriceUsd,
      circulatingSupply,
      dexPoolPranaAmount,
      dexPoolWbtcUsdValue,
      latestSatPrice,
      protocolCapitalUsd,
    ],
  );

  return {
    liquidityDensityPercent,
    protocolCapitalCoveragePercent,
    isLiquidityDensityLoading: isTopHoldingsLoading || isCapitalLoading || isPricesLoading,
    isProtocolCapitalCoverageLoading: isTopHoldingsLoading || isCapitalLoading || isLpLoading || isPricesLoading,
    error: topHoldingsError ?? capitalError ?? lpError ?? pricesError,
  };
}
