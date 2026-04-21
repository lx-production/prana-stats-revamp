/** Time series from DB export: `t` unix seconds, `p` price; ascending by `t`. */
export type PricePoint = {
  t: number;
  p: number;
};

export type PranaSatsDataState = {
  data: PricePoint[];
  isLoading: boolean;
  error: string | null;
};

export type Prana365DataState = {
  data: PricePoint[];
  isLoading: boolean;
  error: string | null;
};
