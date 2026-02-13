import { useCallback, useEffect, useState } from 'react';
import { fetchPranaPricesBundle } from '../utils/pranaPrices';
import type { PranaPricesData } from '../types';

const initialPrices: PranaPricesData = {
  btcPriceUsd: null,
  btcPriceVnd: null,
  usdToVndRate: null,
  latestSatPrice: null,
  isLoading: true,
  error: null,
};

export function usePranaPrices() {
  const [prices, setPrices] = useState<PranaPricesData>(initialPrices);

  const fetchData = useCallback(async () => {
    try {
      const bundle = await fetchPranaPricesBundle();
      setPrices({
        btcPriceUsd: bundle.btcPriceUsd,
        btcPriceVnd: bundle.btcPriceVnd,
        usdToVndRate: bundle.usdToVndRate,
        latestSatPrice: bundle.latestSatPrice,
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

