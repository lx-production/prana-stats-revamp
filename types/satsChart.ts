export type SatsChartPoint = {
  time: number;
  price: number;
};

export type SatsPriceChartProps = {
  chartData: SatsChartPoint[];
  error: string | null;
  isLoading: boolean;
};
