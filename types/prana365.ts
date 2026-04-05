import type { PricePoint } from './pricePoint.ts';

export type Prana365DataState = {
  data: PricePoint[];
  isLoading: boolean;
  error: string | null;
};
