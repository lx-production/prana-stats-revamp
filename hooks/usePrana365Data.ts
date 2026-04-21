import type { Prana365DataState } from '../types/pricePoint';
import { useCallback, useEffect, useState } from 'react';
import { fetchPrana365Data } from '../utils/prana365Data';

const initialState: Prana365DataState = {
  data: [],
  isLoading: true,
  error: null,
};

export function usePrana365Data() {
  const [state, setState] = useState<Prana365DataState>(initialState);

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchPrana365Data();
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
