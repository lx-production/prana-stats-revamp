import React from 'react';
import PerformanceCard from './PerformanceCard';
import type { PranaPerformanceSectionProps } from '../types/performance';
import { usePranaPerformanceMetrics } from '../hooks/usePranaPerformanceMetrics';

const PranaPerformanceSection: React.FC<PranaPerformanceSectionProps> = ({
  priceChange,
  priceChangeBtc,
  isLoading = false,
  btcLoading = false,
  btcError = null,
  fiatLoading = false,
  fiatError = null,
}) => {
  const { fiatPerformance, btcPerformance } = usePranaPerformanceMetrics(priceChange, priceChangeBtc);

  return (
    <>
      <PerformanceCard
        performanceMetrics={btcPerformance}
        compareLabel="PERFORMANCE VS BITCOIN"
        isLoading={isLoading || btcLoading}
        error={btcError}
      />
      <PerformanceCard
        performanceMetrics={fiatPerformance}
        compareLabel="PERFORMANCE VS FIAT"
        isLoading={isLoading || fiatLoading}
        error={fiatError}
      />
    </>
  );
};

export default PranaPerformanceSection;
