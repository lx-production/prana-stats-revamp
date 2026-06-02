export interface SupplyMetricsData {
  circulatingSupply: number;
  buyableSupply: number;
  isCirculatingSupplyLoading: boolean;
  isBuyableSupplyLoading: boolean;
  error: string | null;
}

export interface SupplyMetricsHolder {
  label: string;
  balance: string;
}

export interface ComputedSupplyMetrics {
  circulatingSupply: number;
  buyableSupply: number;
}
