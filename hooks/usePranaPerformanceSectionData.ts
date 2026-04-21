import { useMemo } from 'react';
import { usePranaStats } from './usePranaStats';
import { usePrana365Data } from './usePrana365Data';
import { usePranaSatsData } from './usePranaSatsData';
import { initialPranaStats } from '../constants/pranaStats';
import { buildBtcPriceChange, buildFiatPriceChangeFrom365 } from '../utils/pranaStatsPerformance';

export function usePranaPerformanceSectionData() {
  const {
    latestSatPrice,
    btcPriceUsd,
    isLoading,
  } = usePranaStats();

  const {
    data: d365,
    isLoading: isPrana365Loading,
    error: prana365Error,
  } = usePrana365Data();

  const {
    data: satsData,
    isLoading: isPranaSatsLoading,
    error: pranaSatsError,
  } = usePranaSatsData();

  const priceChangeFiat = useMemo(() => {
    if (typeof btcPriceUsd !== 'number' || typeof latestSatPrice !== 'number') {
      return initialPranaStats.priceChange;
    }

    return buildFiatPriceChangeFrom365({
      btcPriceUsd,
      latestSatPrice,
      d365,
    });
  }, [btcPriceUsd, latestSatPrice, d365]);

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
      fiatLoading: isPrana365Loading,
      fiatError: prana365Error,
    },
  };
}
