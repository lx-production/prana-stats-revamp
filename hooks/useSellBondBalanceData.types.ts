export type SellBondMetricKey = 'balance' | 'committed' | 'totalVolume';

export interface SellBondMetric {
  key: SellBondMetricKey;
  label: string;
  formattedValue: string;
  numericValue: number;
  rawValue: bigint;
}

export interface UseSellBondBalanceDataResult {
  isLoading: boolean;
  error: unknown | null;
  metrics: SellBondMetric[];
}
