import React from 'react';
import PerformanceCard from './PerformanceCard';
import { pranaPerformanceCopy } from './pranaPerformance.copy';
import { usePranaPerformanceMetrics } from '../hooks/usePranaPerformanceMetrics';
import { usePranaPerformanceSectionData } from '../hooks/usePranaPerformanceSectionData';
import { useSiteLanguage } from '../hooks/useSiteLanguage';

const PranaPerformanceSection: React.FC = () => {
  const { locale } = useSiteLanguage();
  const copy = pranaPerformanceCopy[locale];
  const { performanceSectionProps } = usePranaPerformanceSectionData();

  const {
    priceChangeFiat,
    priceChangeBtc,
    isLoading = false,
    btcLoading = false,
    btcError = null,
    fiatLoading = false,
    fiatError = null,
  } = performanceSectionProps;
  
  const { fiatPerformance, btcPerformance } = usePranaPerformanceMetrics(
    priceChangeFiat,
    priceChangeBtc,
    locale,
  );

  return (
    <>
      <PerformanceCard
        performanceMetrics={btcPerformance}
        compareLabel={copy.vsBitcoin}
        loadingLabel={copy.loading}
        isLoading={isLoading || btcLoading}
        error={btcError}
      />
      <PerformanceCard
        performanceMetrics={fiatPerformance}
        compareLabel={copy.vsFiat}
        loadingLabel={copy.loading}
        isLoading={isLoading || fiatLoading}
        error={fiatError}
      />
    </>
  );
};

export default PranaPerformanceSection;
