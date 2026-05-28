export interface SupplyMetricsData {
  circulatingSupply: number;
  buyableSupply: number;
  isCirculatingSupplyLoading: boolean;
  isBuyableSupplyLoading: boolean;
  error: string | null;
}
