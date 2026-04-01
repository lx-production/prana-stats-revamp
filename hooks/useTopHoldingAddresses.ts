import { fetchJson } from '../utils/fetchJson';
import { fetchTopHoldingAddressesJsonSafe } from '../utils/topHoldingAddressesJson';
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clampTopHoldingAddressesPage, getTopHoldingAddressesPageStartIndex, getTopHoldingAddressesTotalPages, TOP_HOLDING_ADDRESSES_PAGE_SIZE } from '../utils/topHoldingAddressesPagination';
import type { TopHoldingAddressesData, TopHoldingAddressesJson } from '../types';

const TOTAL_PAGES = getTopHoldingAddressesTotalPages();

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

function useTopHoldingAddressesInternal() {
  const [data, setData] = useState<TopHoldingAddressesData>(initialTopHoldingAddresses);
  const [allHolders, setAllHolders] = useState(initialTopHoldingAddresses.holders);
  const [loadedPages, setLoadedPages] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = useCallback(async (page: number) => {
    const targetPage = clampTopHoldingAddressesPage(page);
    setData((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      let refreshUpdated = false;
      try {
        const refreshResult = await fetchJson<{ updated?: boolean }>(`/api/refresh-holdings?page=${targetPage}`);
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
      setLoadedPages((prev) => (prev.includes(targetPage) ? prev : [...prev, targetPage]));
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
    if (loadedPages.includes(currentPage)) return;
    void fetchData(currentPage);
  }, [currentPage, fetchData, loadedPages]);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(clampTopHoldingAddressesPage(page));
  }, []);

  const paged = useMemo(() => {
    const startIndex = getTopHoldingAddressesPageStartIndex(currentPage);
    return {
      holders: allHolders.slice(startIndex, startIndex + TOP_HOLDING_ADDRESSES_PAGE_SIZE),
      startIndex,
    };
  }, [allHolders, currentPage]);

  return {
    ...data,
    holders: paged.holders,
    allHolders,
    totalHolders: allHolders.length,
    currentPage,
    totalPages: TOTAL_PAGES,
    startIndex: paged.startIndex,
    goToPage,
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
