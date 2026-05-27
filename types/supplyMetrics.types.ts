export interface SupplyMetricsData {
  circulatingSupply: number;
  buyableSupply: number;
  liquidityDensityPercent: number | null;
  liquidityUsd: number | null;
  isCirculatingSupplyLoading: boolean;
  isBuyableSupplyLoading: boolean;
  isLiquidityDensityLoading: boolean;
  error: string | null;
}
