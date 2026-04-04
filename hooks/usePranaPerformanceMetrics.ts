import { useMemo } from 'react';
import type { PerformanceMetric, PriceChangeSet } from '../types/performance';

const buildPerformanceMetrics = (priceChange: PriceChangeSet): PerformanceMetric[] => [
  { label: '1 Month', value: priceChange.m1 },
  { label: '3 Months', value: priceChange.m3 },
  { label: '6 Months', value: priceChange.m6 },
  { label: '1 Year', value: priceChange.y1 },
  { label: 'ATL', value: priceChange.atl },
];

export function usePranaPerformanceMetrics(priceChange: PriceChangeSet, priceChangeBtc: PriceChangeSet) {
  const performanceMetrics = useMemo(() => buildPerformanceMetrics(priceChange), [priceChange]);
  const performanceMetricsBtc = useMemo(() => buildPerformanceMetrics(priceChangeBtc), [priceChangeBtc]);

  return {
    performanceMetrics,
    performanceMetricsBtc,
  };
}
