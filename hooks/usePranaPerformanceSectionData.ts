import { useMemo } from 'react';
import { usePranaStats } from './usePranaStats';
import { usePrana730Data } from './usePrana730Data';
import { usePranaSatsData } from './usePranaSatsData';
import { initialPranaStats } from '../constants/pranaStats';
import { buildBtcPriceChange, buildFiatPriceChange } from '../utils/pranaStatsPerformance';

export function usePranaPerformanceSectionData() {
  const {
    latestSatPrice,
    btcPriceUsd,
    isLoading,
  } = usePranaStats();

  const {
    data: usdHistory,
    isLoading: isPrana730Loading,
    error: prana730Error,
  } = usePrana730Data();

  const {
    data: satsData,
    isLoading: isPranaSatsLoading,
    error: pranaSatsError,
  } = usePranaSatsData();

  const priceChangeFiat = useMemo(() => {
    if (typeof btcPriceUsd !== 'number' || typeof latestSatPrice !== 'number') {
      return initialPranaStats.priceChange;
    }

    return buildFiatPriceChange({
      btcPriceUsd,
      latestSatPrice,
      usdHistory,
    });
  }, [btcPriceUsd, latestSatPrice, usdHistory]);

  const priceChangeBtc = useMemo(() => {
    if (typeof latestSatPrice !== 'number') {
      return initialPranaStats.priceChangeBtc;
    }

    return buildBtcPriceChange(latestSatPrice, satsData);
  }, [latestSatPrice, satsData]);

  return {
    performanceSectionProps: {
      priceChangeFiat,
      priceChangeBtc,
      isLoading,
      btcLoading: isPranaSatsLoading,
      btcError: pranaSatsError,
      fiatLoading: isPrana730Loading,
      fiatError: prana730Error,
    },
  };
}
