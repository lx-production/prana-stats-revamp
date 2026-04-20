import { useMemo } from 'react';
import { usePranaStats } from './usePranaStats';

export function useBasicStats() {
  const {
    marketCapVnd,
    latestSatPrice,
    btcPriceUsd,
    isLoading,
    error,
  } = usePranaStats();

  const pranaPriceUsd = useMemo(() => {
    return ((latestSatPrice ?? 0) / 1e8) * (btcPriceUsd ?? 0);
  }, [btcPriceUsd, latestSatPrice]);

  return {
    error,
    basicStatsProps: {
      marketCapVnd,
      latestSatPrice,
      pranaPriceUsd,
      isLoading,
    },
  };
}
