export interface LiquidityMetricsData {
  liquidityDensityPercent: number | null;
  protocolCapitalCoveragePercent: number | null;
  isLiquidityDensityLoading: boolean;
  isProtocolCapitalCoverageLoading: boolean;
  error: string | null;
}

export interface LiquidityMetricsInputs {
  btcPriceUsd: number;
  latestSatPrice: number;
  circulatingSupply: number;
  dexPoolPranaAmount: number;
  dexPoolWbtcUsdValue: number;
  protocolCapitalUsd: number;
}

export interface ComputedLiquidityMetrics {
  liquidityDensityPercent: number | null;
  protocolCapitalCoveragePercent: number | null;
}
