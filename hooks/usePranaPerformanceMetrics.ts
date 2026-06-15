import { useMemo } from 'react';
import type { PerformanceMetric, PriceChangeSet } from '../types/performance';

const buildFiatPerformanceMetrics = (priceChange: PriceChangeSet): PerformanceMetric[] => [
  { label: '1 Month', value: priceChange.m1 },
  { label: '3 Months', value: priceChange.m3 },
  { label: '6 Months', value: priceChange.m6 },
  { label: '1 Year', value: priceChange.y1 },
  { label: '2 Years', value: priceChange.y2 ?? 0 },
  { label: 'ATL', value: priceChange.atl },
];

const buildBtcPerformanceMetrics = (priceChange: PriceChangeSet): PerformanceMetric[] => [
  { label: '1 Month', value: priceChange.m1 },
  { label: '3 Months', value: priceChange.m3 },
  { label: '6 Months', value: priceChange.m6 },
  { label: '1 Year', value: priceChange.y1 },
  { label: '2 Years', value: priceChange.y2 ?? 0 },
  { label: 'ATL', value: priceChange.atl },
];

export function usePranaPerformanceMetrics(priceChangeFiat: PriceChangeSet, priceChangeBtc: PriceChangeSet) {
  const fiatPerformance = useMemo(() => buildFiatPerformanceMetrics(priceChangeFiat), [priceChangeFiat]);
  const btcPerformance = useMemo(() => buildBtcPerformanceMetrics(priceChangeBtc), [priceChangeBtc]);

  return {
    fiatPerformance,
    btcPerformance,
  };
}
