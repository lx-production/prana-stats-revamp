import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../utils/fetchJson';
import type { LpCapitalData } from '../types/capital.types';
import type { LpCapitalApiResponse } from '../types/api.types';

const initialState: LpCapitalData = {
  usdValueNumber: 0,
  usdValue: '$0.00',
  apr24hPercent: null,
  apr24hLabel: null,
  positionIds: [],
  activePositionsCount: 0,
  isLoading: true,
  error: null,
};

export const useArbitrumWbtcUsdtLpValue = (): LpCapitalData => {
  const [state, setState] = useState<LpCapitalData>(initialState);

  const fetchLpValue = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      setState({
        ...(await fetchJson<LpCapitalApiResponse>('/api/lp-capital')),
        isLoading: false,
        error: null,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Failed to fetch LP value';

      setState({
        usdValueNumber: 0,
        usdValue: '$0.00',
        apr24hPercent: null,
        apr24hLabel: null,
        positionIds: [],
        activePositionsCount: 0,
        isLoading: false,
        error: message,
      });
    }
  }, []);

  useEffect(() => {
    fetchLpValue();
  }, [fetchLpValue]);

  return useMemo(() => state, [state]);
};
