import React, { useEffect, useMemo, useState } from 'react';
import SatsPriceChart from './SatsPriceChart';
import PranaVndPriceChart from './PranaVndPriceChart';
import { usePrana365Data } from '../hooks/usePrana365Data';
import { usePranaSatsData } from '../hooks/usePranaSatsData';
import { usePranaStats } from '../hooks/usePranaStats';
import { fetchJson } from '../utils/fetchJson';
import { resolveUsdToVndRateForChart } from '../utils/pranaVndChart';
import type { SatsChartPoint } from '../types/satsChart';
import type { RangeKey, PranaVndChartPoint } from '../types/pranaVndChart';
import type { PricePoint } from '../types/pricePoint';

const MAX_POINTS = 150;
const RANGE_FILES: Record<Exclude<RangeKey, '365_days'>, string> = {
  '30_days': '/data_30_days.json',
  '90_days': '/data_90_days.json',
  '180_days': '/data_180_days.json',
  max: '/data_max.json',
};

const PriceChartsSection: React.FC = () => {
  const { usdToVndRate } = usePranaStats();
  const { data: d365, isLoading: isPrana365Loading, error: prana365Error } = usePrana365Data();
  const { data: satsData, isLoading: isPranaSatsLoading, error: pranaSatsError } = usePranaSatsData();
  const [selectedRange, setSelectedRange] = useState<RangeKey>('365_days');
  const [rangeData, setRangeData] = useState<Partial<Record<RangeKey, PricePoint[]>>>({});
  const [rangeErrors, setRangeErrors] = useState<Partial<Record<RangeKey, string | null>>>({});

  useEffect(() => {
    if (selectedRange === '365_days' || rangeData[selectedRange]) return;

    let isActive = true;
    const non365Range = selectedRange as Exclude<RangeKey, '365_days'>;

    const loadRangeData = async () => {
      const file = RANGE_FILES[non365Range];
      if (!file) return;

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
  const rawData = selectedRange === '365_days' ? d365 : (rangeData[selectedRange] ?? []);
  const isLoading =
    selectedRange === '365_days'
      ? isPrana365Loading
      : !rangeData[selectedRange] && rangeErrors[selectedRange] == null;
  const error = selectedRange === '365_days' ? prana365Error : (rangeErrors[selectedRange] ?? null);
  const chartData = useMemo(() => {
    if (rawData.length === 0) {
      return [] as PranaVndChartPoint[];
    }

    const sorted = [...rawData].sort((a, b) => a.t - b.t);
    const step = Math.max(1, Math.ceil(sorted.length / MAX_POINTS));
    const sampled = sorted.filter((_, index) => index % step === 0 || index === sorted.length - 1);

    return sampled.map((point) => ({
      time: point.t * 1000,
      price: Math.round(point.p * effectiveUsdToVndRate),
    }));
  }, [rawData, effectiveUsdToVndRate]);
  const satsChartData = useMemo(() => {
    if (satsData.length === 0) {
      return [] as SatsChartPoint[];
    }

    const sorted = [...satsData].sort((a, b) => a.t - b.t);
    const step = Math.max(1, Math.ceil(sorted.length / MAX_POINTS));
    const sampled = sorted.filter((_, index) => index % step === 0 || index === sorted.length - 1);

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
