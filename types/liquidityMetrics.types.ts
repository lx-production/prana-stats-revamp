export interface LiquidityMetricsData {
  liquidityDensityPercent: number | null;
  protocolCapitalCoveragePercent: number | null;
  isLiquidityDensityLoading: boolean;
  isProtocolCapitalCoverageLoading: boolean;
  error: string | null;
}
