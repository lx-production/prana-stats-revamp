import React from 'react';
import type { PranaPerformanceSectionProps } from '../types/performance';
import { usePranaPerformanceMetrics } from '../hooks/usePranaPerformanceMetrics';
import PerformanceCard from './PerformanceCard';

const PranaPerformanceSection: React.FC<PranaPerformanceSectionProps> = ({ priceChange, priceChangeBtc }) => {
  const { performanceMetrics, performanceMetricsBtc } = usePranaPerformanceMetrics(priceChange, priceChangeBtc);

  return (
    <>
      <PerformanceCard performanceMetrics={performanceMetricsBtc} compareLabel="PERFORMANCE VS BITCOIN" />
      <PerformanceCard performanceMetrics={performanceMetrics} compareLabel="PERFORMANCE VS FIAT" />
    </>
  );
};

export default PranaPerformanceSection;
