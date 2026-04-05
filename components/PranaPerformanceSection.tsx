import React from 'react';
import type { PranaPerformanceSectionProps } from '../types/performance';
import { usePranaPerformanceMetrics } from '../hooks/usePranaPerformanceMetrics';
import PerformanceCard from './PerformanceCard';

const PranaPerformanceSection: React.FC<PranaPerformanceSectionProps> = ({
  priceChange,
  priceChangeBtc,
  isLoading = false,
  btcLoading = false,
  btcError = null,
  fiatLoading = false,
  fiatError = null,
}) => {
  const { performanceMetrics, performanceMetricsBtc } = usePranaPerformanceMetrics(priceChange, priceChangeBtc);

  return (
    <>
      <PerformanceCard
        performanceMetrics={performanceMetricsBtc}
        compareLabel="PERFORMANCE VS BITCOIN"
        isLoading={isLoading || btcLoading}
        error={btcError}
      />
      <PerformanceCard
        performanceMetrics={performanceMetrics}
        compareLabel="PERFORMANCE VS FIAT"
        isLoading={isLoading || fiatLoading}
        error={fiatError}
      />
    </>
  );
};

export default PranaPerformanceSection;
