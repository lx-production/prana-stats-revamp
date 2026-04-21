import React from 'react';
import PerformanceCard from './PerformanceCard';
import { usePranaPerformanceMetrics } from '../hooks/usePranaPerformanceMetrics';
import type { PranaPerformanceSectionProps } from '../types/performance';

const PranaPerformanceSection: React.FC<PranaPerformanceSectionProps> = ({
  priceChangeFiat,
  priceChangeBtc,
  isLoading = false,
  btcLoading = false,
  btcError = null,
  fiatLoading = false,
  fiatError = null,
}) => {
  const { fiatPerformance, btcPerformance } = usePranaPerformanceMetrics(priceChangeFiat, priceChangeBtc);

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
