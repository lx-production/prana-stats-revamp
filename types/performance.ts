import type { PricePoint } from './pricePoint.ts';

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
};

export type PranaPerformanceSectionProps = {
  priceChange: PriceChangeSet;
  priceChangeBtc: PriceChangeSet;
};

export type SatsPerformanceInputs = {
  parsedSatsData: PricePoint[];
  m1Cutoff: number;
  m3Cutoff: number;
  m6Cutoff: number;
  y1Cutoff: number;
  safeSatsAtl: number;
};
