import { useMemo } from 'react';
import { initialPranaStats } from '../constants/pranaStats';
import { usePrana365Data } from './usePrana365Data';
import { usePranaSatsData } from './usePranaSatsData';
import { usePranaStats } from './usePranaStats';
import { buildBtcPriceChange, buildFiatPriceChangeFrom365 } from '../utils/pranaStatsPerformance';

export function usePranaStatsSection() {
  const {
    marketCapVnd,
    latestSatPrice,
    btcPriceUsd,
    isLoading,
    error,
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

  const pranaPriceUsd = useMemo(() => {
    return ((latestSatPrice ?? 0) / 1e8) * (btcPriceUsd ?? 0);
  }, [btcPriceUsd, latestSatPrice]);

  const priceChange = useMemo(() => {
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
    error,
    basicStatsProps: {
      marketCapVnd,
      latestSatPrice,
      pranaPriceUsd,
      isLoading,
    },
    performanceSectionProps: {
      priceChange,
      priceChangeBtc,
      isLoading,
      btcLoading: isPranaSatsLoading,
      btcError: pranaSatsError,
      fiatLoading: isPrana365Loading,
      fiatError: prana365Error,
    },
  };
}
