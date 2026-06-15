import SatsPriceChart from './SatsPriceChart';
import PranaVndPriceChart from './PranaVndPriceChart';
import React, { useEffect, useMemo, useState } from 'react';
import { usePranaSatsData } from '../hooks/usePranaSatsData';
import { usePranaStats } from '../hooks/usePranaStats';
import { fetchJson } from '../utils/fetchJson';
import { resolveUsdToVndRateForChart } from '../utils/pranaVndChart';
import type { SatsChartPoint, RangeKey, PranaVndChartPoint } from '../types/charts';
import type { PricePoint } from '../types/pricePoint';

const MAX_POINTS = 150;

// Price/sats series from JSON exports and hooks are already ordered by `t` ascending.
// Intentionally no `.sort` before downsampling (avoids O(n log n) on large arrays); re-add only if a source breaks that contract.

const RANGE_FILES: Record<RangeKey, string> = {
  '30_days': '/data_30_days.json',
  '90_days': '/data_90_days.json',
  '180_days': '/data_180_days.json',
  '365_days': '/data_365_days.json',
  max: '/data_max.json',
};

const PriceChartsSection: React.FC = () => {
  const { usdToVndRate } = usePranaStats();
  const { data: satsData, isLoading: isPranaSatsLoading, error: pranaSatsError } = usePranaSatsData();
  const [selectedRange, setSelectedRange] = useState<RangeKey>('180_days');
  const [rangeData, setRangeData] = useState<Partial<Record<RangeKey, PricePoint[]>>>({});
  const [rangeErrors, setRangeErrors] = useState<Partial<Record<RangeKey, string | null>>>({});

  useEffect(() => {
    if (rangeData[selectedRange]) return;

    let isActive = true;

    const loadRangeData = async () => {
      const file = RANGE_FILES[selectedRange];

      try {
        const json = await fetchJson<PricePoint[]>(file);
        if (!isActive) return;

        setRangeData(prev => ({
          ...prev,
          [selectedRange]: Array.isArray(json) ? json : [],
        }));
        setRangeErrors(prev => ({
          ...prev,
          [selectedRange]: null,
        }));
      } catch (err: any) {
        if (!isActive) return;

        const message =
          typeof err?.message === 'string' && err.message.trim().length > 0
            ? err.message
            : `Failed to fetch ${file}`;

        setRangeErrors(prev => ({
          ...prev,
          [selectedRange]: message,
        }));
      }
    };

    loadRangeData();

    return () => {
      isActive = false;
    };
  }, [selectedRange, rangeData]);

  const effectiveUsdToVndRate = useMemo(
    () => resolveUsdToVndRateForChart(usdToVndRate),
    [usdToVndRate]
  );
  const rawData = rangeData[selectedRange] ?? [];
  const isLoading = !rangeData[selectedRange] && rangeErrors[selectedRange] == null;
  const error = rangeErrors[selectedRange] ?? null;
  const chartData = useMemo(() => {
    if (rawData.length === 0) {
      return [] as PranaVndChartPoint[];
    }

    const step = Math.max(1, Math.ceil(rawData.length / MAX_POINTS));
    const sampled = rawData.filter((_, index) => index % step === 0 || index === rawData.length - 1);

    return sampled.map((point) => ({
      time: point.t * 1000,
      price: Math.round(point.p * effectiveUsdToVndRate),
    }));
  }, [rawData, effectiveUsdToVndRate]);
  const satsChartData = useMemo(() => {
    if (satsData.length === 0) {
      return [] as SatsChartPoint[];
    }

    const step = Math.max(1, Math.ceil(satsData.length / MAX_POINTS));
    const sampled = satsData.filter((_, index) => index % step === 0 || index === satsData.length - 1);

    return sampled.map((point) => ({
      time: point.t * 1000,
      price: point.p,
    }));
  }, [satsData]);

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <SatsPriceChart
          chartData={satsChartData}
          error={pranaSatsError}
          isLoading={isPranaSatsLoading}
        />
        <PranaVndPriceChart
          chartData={chartData}
          error={error}
          isLoading={isLoading}
          selectedRange={selectedRange}
          onSelectRange={setSelectedRange}
        />
      </div>
    </section>
  );
};

export default PriceChartsSection;
