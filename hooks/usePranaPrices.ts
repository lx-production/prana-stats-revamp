import { useCallback, useEffect, useState } from 'react';
import { fetchPranaStatsApi, getCachedPranaStatsApi } from '../utils/pranaStatsApi';
import type { PranaPricesData } from '../types';
import type { PranaStatsApiResponse } from '../types/api.types';

const initialPrices: PranaPricesData = {
  btcPriceUsd: null,
  btcPriceVnd: null,
  usdToVndRate: null,
  latestSatPrice: null,
  isLoading: true,
  error: null,
};

export function usePranaPrices() {
  const [prices, setPrices] = useState<PranaPricesData>(() => {
    const cached = getCachedPranaStatsApi();
    if (!cached) return initialPrices;

    return {
      btcPriceUsd: cached.btcPriceUsd,
      btcPriceVnd: cached.btcPriceVnd,
      usdToVndRate: cached.usdToVndRate,
      latestSatPrice: cached.latestSatPrice,
      isLoading: false,
      error: null,
    };
  });

  const fetchData = useCallback(async () => {
    try {
      const cached = getCachedPranaStatsApi();
      const snapshot: PranaStatsApiResponse = cached ?? await fetchPranaStatsApi();
      setPrices({
        btcPriceUsd: snapshot.btcPriceUsd,
        btcPriceVnd: snapshot.btcPriceVnd,
        usdToVndRate: snapshot.usdToVndRate,
        latestSatPrice: snapshot.latestSatPrice,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      console.error('Failed to fetch Prana prices:', err);
      const message =
        typeof err?.message === 'string' && err.message.trim().length > 0
          ? err.message
          : 'Failed to fetch Prana prices';
      setPrices(prev => ({ ...prev, isLoading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return prices;
}

