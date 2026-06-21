import { useMemo } from 'react';
import { pranaPerformanceCopy } from '../components/pranaPerformance.copy';
import type { SiteLocale } from '../types/locale.types';
import type { PerformanceMetric, PriceChangeSet } from '../types/performance';

const buildPerformanceMetrics = (
  priceChange: PriceChangeSet,
  locale: SiteLocale,
): PerformanceMetric[] => {
  const { periods } = pranaPerformanceCopy[locale];

  return [
    { label: periods.m1, value: priceChange.m1 },
    { label: periods.m3, value: priceChange.m3 },
    { label: periods.m6, value: priceChange.m6 },
    { label: periods.y1, value: priceChange.y1 },
    { label: periods.y2, value: priceChange.y2 ?? 0 },
    { label: periods.atl, value: priceChange.atl },
  ];
};

export function usePranaPerformanceMetrics(
  priceChangeFiat: PriceChangeSet,
  priceChangeBtc: PriceChangeSet,
  locale: SiteLocale,
) {
  const fiatPerformance = useMemo(
    () => buildPerformanceMetrics(priceChangeFiat, locale),
    [priceChangeFiat, locale],
  );
  const btcPerformance = useMemo(
    () => buildPerformanceMetrics(priceChangeBtc, locale),
    [priceChangeBtc, locale],
  );

  return {
    fiatPerformance,
    btcPerformance,
  };
}
