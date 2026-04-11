import { fetchJson } from '../utils/fetchJson';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CapitalData } from '../types/capital.types';
import type { CapitalApiResponse } from '../types/api.types';

const initialState: CapitalData = {
  items: [],
  isLoading: true,
  error: null,
};

export const useCapital = (): CapitalData => {
  const [state, setState] = useState<CapitalData>(initialState);

  const fetchBalances = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      setState({
        items: (await fetchJson<CapitalApiResponse>('/api/capital')).items,
        isLoading: false,
        error: null,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim().length > 0 ? error.message : 'Failed to fetch capital balances';

      setState({
        items: [],
        isLoading: false,
        error: message,
      });
    }
  }, []);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return useMemo(() => state, [state]);
};
