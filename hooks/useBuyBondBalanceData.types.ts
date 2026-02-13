export type BuyBondMetricKey = 'balance' | 'committed' | 'totalVolume';

export interface BuyBondMetric {
  key: BuyBondMetricKey;
  label: string;
  formattedValue: string;
  numericValue: number;
  rawValue: bigint;
}

export interface UseBuyBondBalanceDataResult {
  isLoading: boolean;
  error: unknown | null;
  metrics: BuyBondMetric[];
}
