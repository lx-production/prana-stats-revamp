import { useCallback, useEffect, useState } from 'react';
import { fetchBuyDipsJson, getCachedBuyDipsJson } from '../utils/buyDipsJson';
import type { BuyDipsData, BuyDipsJson } from '../types/buyDips.types';

const fallbackBuyDips: BuyDipsJson = {
  total_volume_in_usd: undefined,
  total_prana_bought: undefined,
  total_buy_transactions: undefined,
};

const initialBuyDips: BuyDipsData = {
  ...fallbackBuyDips,
  isLoading: true,
  error: null,
};

const toLoadedBuyDips = (json: BuyDipsJson): BuyDipsData => ({
  total_volume_in_usd: json?.total_volume_in_usd,
  total_prana_bought: json?.total_prana_bought,
  total_buy_transactions: json?.total_buy_transactions,
  isLoading: false,
  error: null,
});

export function useBuyDips() {
  const [data, setData] = useState<BuyDipsData>(() => {
    const cached = getCachedBuyDipsJson();
    return cached ? toLoadedBuyDips(cached) : initialBuyDips;
  });

  const fetchData = useCallback(async () => {
    const cached = getCachedBuyDipsJson();
    if (cached) {
      setData(toLoadedBuyDips(cached));
      return;
    }

    try {
      const json = await fetchBuyDipsJson<BuyDipsJson>();
      setData(toLoadedBuyDips(json));
    } catch (err: any) {
      const message =
        typeof err?.message === 'string' && err.message.trim().length > 0
          ? err.message
          : 'Failed to fetch buy_dips.json';

      setData({
        ...fallbackBuyDips,
        isLoading: false,
        error: message,
      });
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return data;
}
