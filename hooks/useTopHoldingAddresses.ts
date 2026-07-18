import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchJson } from '../utils/fetchJson';
import { TOP_HOLDING_ADDRESSES } from '../constants/topHoldingAddresses';
import type { TopHoldingAddressesData, TopHoldingAddressesJson } from '../types';

const TOTAL_HOLDERS = TOP_HOLDING_ADDRESSES.length;
const HOLDERS_PER_PAGE = 5;
const PAGE_COUNT = Math.ceil(TOTAL_HOLDERS / HOLDERS_PER_PAGE);

type TopHoldingAddressesContextValue = TopHoldingAddressesData & {
  activePage: number;
  pageCount: number;
  pageHolders: TopHoldingAddressesData['holders'];
  isPageLoading: boolean;
  setActivePage: (page: number) => void;
};

function useTopHoldingAddressesInternal(): TopHoldingAddressesContextValue {
  const [holdersByPage, setHoldersByPage] = useState<Record<number, TopHoldingAddressesData['holders']>>({});
  const [activePage, setActivePage] = useState(1);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (holdersByPage[activePage]) return;

    let cancelled = false;
    setError(null);

    void fetchJson<TopHoldingAddressesJson>(`/api/top-holding-addresses?page=${activePage}`)
      .then((json) => {
        if (cancelled) return;
        // Server already returns one page of holders.
        const responseHolders = Array.isArray(json?.holders) ? json.holders : [];
        setHoldersByPage((pages) => ({
          ...pages,
          [activePage]: responseHolders,
        }));
        setGeneratedAt(typeof json?.generatedAt === 'string' ? json.generatedAt : null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('Failed to fetch top holding addresses:', err);
        setError(
          err instanceof Error && err.message.trim().length > 0
            ? err.message
            : 'Failed to fetch top holding addresses',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [activePage, holdersByPage]);

  const holders = useMemo(
    () => Array.from({ length: PAGE_COUNT }, (_, index) => holdersByPage[index + 1] ?? []).flat(),
    [holdersByPage],
  );
  const pageHolders = holdersByPage[activePage] ?? [];
  const isPageLoading = !holdersByPage[activePage];

  return {
    holders,
    totalHolders: TOTAL_HOLDERS,
    generatedAt,
    isLoading: !holdersByPage[1],
    error,
    activePage,
    pageCount: PAGE_COUNT,
    pageHolders,
    isPageLoading,
    setActivePage: (page) => setActivePage(Math.min(Math.max(page, 1), PAGE_COUNT)),
  };
}

const TopHoldingAddressesContext = createContext<TopHoldingAddressesContextValue | null>(null);

export function TopHoldingAddressesProvider({ children }: { children: ReactNode }) {
  const value = useTopHoldingAddressesInternal();
  return createElement(TopHoldingAddressesContext.Provider, { value }, children);
}

export function useTopHoldingAddresses() {
  const context = useContext(TopHoldingAddressesContext);
  return context ?? useTopHoldingAddressesInternal();
}
