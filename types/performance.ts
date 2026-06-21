export type PriceChangeSet = {
  m1: number;
  m3: number;
  m6: number;
  y1: number;
  y2?: number;
  atl: number;
};

export type PerformanceMetric = {
  label: string;
  value: number;
};

export type PerformanceCardProps = {
  performanceMetrics: PerformanceMetric[];
  compareLabel: string;
  loadingLabel?: string;
  isLoading?: boolean;
  error?: string | null;
};
