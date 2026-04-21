export type PriceChangeSet = {
  m1: number;
  m3: number;
  m6: number;
  y1: number;
  atl: number;
};

export type PerformanceMetric = {
  label: string;
  value: number;
};

export type PranaPriceChanges = {
  priceChange: PriceChangeSet;
  priceChangeBtc: PriceChangeSet;
};

export type PerformanceCardProps = {
  performanceMetrics: PerformanceMetric[];
  compareLabel: string;
  isLoading?: boolean;
  error?: string | null;
};

export type PranaPerformanceSectionProps = {
  priceChangeFiat: PriceChangeSet;
  priceChangeBtc: PriceChangeSet;
  isLoading?: boolean;
  btcLoading?: boolean;
  btcError?: string | null;
  fiatLoading?: boolean;
  fiatError?: string | null;
};
