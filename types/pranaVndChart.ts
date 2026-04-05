export type RangeKey = '30_days' | '90_days' | '180_days' | '365_days' | 'max';

export type PranaVndChartPoint = {
  time: number;
  price: number;
};

export type PranaVndPriceChartProps = {
  chartData: PranaVndChartPoint[];
  error: string | null;
  isLoading: boolean;
  selectedRange: RangeKey;
  onSelectRange: (range: RangeKey) => void;
};
