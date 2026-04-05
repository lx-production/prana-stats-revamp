import type { PricePoint } from './pricePoint.ts';

export type PranaSatsDataState = {
  data: PricePoint[];
  isLoading: boolean;
  error: string | null;
};
