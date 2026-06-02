import type { CapitalItem } from '../types/capital.types';
import type { ComputedLiquidityMetrics, LiquidityMetricsInputs } from '../types/liquidityMetrics.types';
import type { SupplyMetricsHolder } from '../types/supplyMetrics.types';

export const SATS_PER_BTC = 100_000_000;
export const DEX_POOL_LABEL = 'WBTC/PRANA DEX Pool';
export const DEX_POOL_WBTC_CAPITAL_ID = 'wbtc-prana-pool';

function toFiniteNumber(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function getDexPoolPranaAmount(holders: SupplyMetricsHolder[]): number {
  return toFiniteNumber(holders.find((holder) => holder.label === DEX_POOL_LABEL)?.balance);
}

export function getDexPoolWbtcUsdValue(items: CapitalItem[]): number {
  return toFiniteNumber(items.find((item) => item.id === DEX_POOL_WBTC_CAPITAL_ID)?.usdValueNumber);
}

export function computeLiquidityMetrics(params: LiquidityMetricsInputs): ComputedLiquidityMetrics {
  const {
    btcPriceUsd,
    latestSatPrice,
    circulatingSupply,
    dexPoolPranaAmount,
    dexPoolWbtcUsdValue,
    protocolCapitalUsd,
  } = params;

  if (
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
  const liquidityUsd = dexPoolWbtcUsdValue + dexPoolPranaAmount * pranaUsdPrice;

  const liquidityDensityPercent = circulatingMarketCapUsd > 0 && Number.isFinite(liquidityUsd)
    ? (liquidityUsd / circulatingMarketCapUsd) * 100
    : null;
  const protocolCapitalCoveragePercent = circulatingMarketCapUsd > 0 && Number.isFinite(protocolCapitalUsd)
    ? (protocolCapitalUsd / circulatingMarketCapUsd) * 100
    : null;

  return {
    liquidityDensityPercent: Number.isFinite(liquidityDensityPercent) ? liquidityDensityPercent : null,
    protocolCapitalCoveragePercent: Number.isFinite(protocolCapitalCoveragePercent)
      ? protocolCapitalCoveragePercent
      : null,
  };
}
