export type PerformanceMetric = {
  label: string;
  value: number;
};

export type PerformanceCardProps = {
  performanceMetrics: PerformanceMetric[];
  compareLabel: string;
};

export type SatsPerformanceInputs = {
  parsedSatsData: Array<{ t?: number; p?: number }>;
  m1Cutoff: number;
  m3Cutoff: number;
  m6Cutoff: number;
  y1Cutoff: number;
  safeSatsAtl: number;
};
