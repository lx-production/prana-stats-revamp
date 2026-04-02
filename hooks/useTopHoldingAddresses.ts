import { fetchJson } from '../utils/fetchJson';
import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { TOP_HOLDING_ADDRESSES } from '../constants/topHoldingAddresses';
import type { TopHoldingAddressesData, TopHoldingAddressesJson } from '../types';

const TOTAL_HOLDERS = TOP_HOLDING_ADDRESSES.length;

const initialTopHoldingAddresses: TopHoldingAddressesData = {
  holders: [],
  totalHolders: 0,
  generatedAt: null,
  isLoading: true,
  error: null,
};

function useTopHoldingAddressesInternal() {
  const [data, setData] = useState<TopHoldingAddressesData>(initialTopHoldingAddresses);

  const fetchData = useCallback(async () => {
    setData((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const json = await fetchJson<TopHoldingAddressesJson>('/api/top-holding-addresses');

      setData({
        holders: Array.isArray(json?.holders) ? json.holders : [],
        totalHolders: TOTAL_HOLDERS,
        generatedAt: typeof json?.generatedAt === 'string' ? json.generatedAt : null,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      console.error('Failed to fetch top holding addresses:', err);
      const message =
        typeof err?.message === 'string' && err.message.trim().length > 0
          ? err.message
          : 'Failed to fetch top holding addresses';
      setData((prev) => ({
        ...prev,
        holders: [],
        totalHolders: TOTAL_HOLDERS,
        isLoading: false,
        error: message,
      }));
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    ...data,
    totalHolders: TOTAL_HOLDERS,
  };
}

const TopHoldingAddressesContext = createContext<TopHoldingAddressesData | null>(null);

export function TopHoldingAddressesProvider({ children }: { children: ReactNode }) {
  const value = useTopHoldingAddressesInternal();
  return createElement(TopHoldingAddressesContext.Provider, { value }, children);
}

export function useTopHoldingAddresses() {
  const context = useContext(TopHoldingAddressesContext);
  return context ?? useTopHoldingAddressesInternal();
}
