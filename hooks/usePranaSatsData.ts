import { useCallback, useEffect, useState } from 'react';
import type { PranaSatsDataState } from '../types/pranaSats';
import { fetchPranaSatsData, getCachedPranaSatsData } from '../utils/pranaSatsData';

const initialState: PranaSatsDataState = {
  data: [],
  isLoading: true,
  error: null,
};

export function usePranaSatsData() {
  const [state, setState] = useState<PranaSatsDataState>(() => {
    const cached = getCachedPranaSatsData();
    if (!cached) return initialState;

    return {
      data: cached,
      isLoading: false,
      error: null,
    };
  });

  const fetchData = useCallback(async () => {
    try {
      const cached = getCachedPranaSatsData();
      const data = cached ?? await fetchPranaSatsData();
      setState({
        data,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      console.error('Failed to fetch PRANA sats data:', err);
      const message =
        typeof err?.message === 'string' && err.message.trim().length > 0
          ? err.message
          : 'Failed to fetch data_sats.json';

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return state;
}
