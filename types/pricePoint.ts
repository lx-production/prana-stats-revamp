/** Time series from DB export: `t` unix seconds, `p` price; ascending by `t`. */
export type PricePoint = {
  t: number;
  p: number;
};
