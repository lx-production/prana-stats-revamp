import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../utils/fetchJson';
import { fetchTopHoldingAddressesJsonSafe } from '../utils/topHoldingAddressesJson';
import type { TopHoldingAddressesData, TopHoldingAddressesJson } from '../types';

const PAGE_SIZE = 10;
const TOTAL_PAGES = 2;

const initialTopHoldingAddresses: TopHoldingAddressesData = {
  holders: [],
  totalHolders: 0,
  generatedAt: null,
  currentPage: 1,
  totalPages: TOTAL_PAGES,
  startIndex: 0,
  goToPage: () => {},
  isLoading: true,
  error: null,
};

const fallbackTopHoldingAddressesJson: TopHoldingAddressesJson = {
  holders: [],
};

export function useTopHoldingAddresses() {
  const [data, setData] = useState<TopHoldingAddressesData>(initialTopHoldingAddresses);
  const [allHolders, setAllHolders] = useState(initialTopHoldingAddresses.holders);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      let refreshUpdated = false;
      try {
        const refreshResult = await fetchJson<{ updated?: boolean }>('/api/top-holding-addresses/refresh');
        refreshUpdated = Boolean(refreshResult?.updated);
      } catch {
        // Ignore refresh errors and use existing JSON.
      }

      const json = await fetchTopHoldingAddressesJsonSafe<TopHoldingAddressesJson>(
        fallbackTopHoldingAddressesJson,
        { force: refreshUpdated }
      );

      const nextHolders = Array.isArray(json?.holders) ? json.holders : [];
      setAllHolders(nextHolders);
      setCurrentPage(1);
      setData((prev) => ({
        ...prev,
        generatedAt: typeof json?.generatedAt === 'string' ? json.generatedAt : null,
        isLoading: false,
        error: null,
      }));
    } catch (err: any) {
      console.error('Failed to fetch top holding addresses:', err);
      const message =
        typeof err?.message === 'string' && err.message.trim().length > 0
          ? err.message
          : 'Failed to fetch top holding addresses';
      setData((prev) => ({ ...prev, isLoading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(() => {
      if (page < 1) return 1;
      if (page > TOTAL_PAGES) return TOTAL_PAGES;
      return page;
    });
  }, []);

  const paged = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return {
      holders: allHolders.slice(startIndex, startIndex + PAGE_SIZE),
      startIndex,
    };
  }, [allHolders, currentPage]);

  return {
    ...data,
    holders: paged.holders,
    totalHolders: allHolders.length,
    currentPage,
    totalPages: TOTAL_PAGES,
    startIndex: paged.startIndex,
    goToPage,
  };
}

