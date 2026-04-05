import type { Prana365DataState } from '../types/prana365';
import { useCallback, useEffect, useState } from 'react';
import { fetchPrana365Data, getCachedPrana365Data } from '../utils/prana365Data';

const initialState: Prana365DataState = {
  data: [],
  isLoading: true,
  error: null,
};

export function usePrana365Data() {
  const [state, setState] = useState<Prana365DataState>(() => {
    const cached = getCachedPrana365Data();
    if (!cached) return initialState;

    return {
      data: cached,
      isLoading: false,
      error: null,
    };
  });

  const fetchData = useCallback(async () => {
    try {
      const cached = getCachedPrana365Data();
      const data = cached ?? await fetchPrana365Data();
      setState({
        data,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      console.error('Failed to fetch PRANA 365 data:', err);
      const message =
        typeof err?.message === 'string' && err.message.trim().length > 0
          ? err.message
          : 'Failed to fetch data_365_days.json';

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
