export interface CapitalItem {
  id: string;
  label: string;
  tokenSymbol: 'USDT' | 'WBTC';
  network: 'Polygon' | 'Arbitrum';
  address: string;
  amount: string;
  amountValue: number;
  usdValue?: string | null;
  usdValueNumber?: number | null;
}

export interface CapitalData {
  items: CapitalItem[];
  isLoading: boolean;
  error: string | null;
}

export interface LpCapitalData {
  usdValueNumber: number;
  usdValue: string;
  apr24hPercent: number | null;
  apr24hLabel: string | null;
  positionIds: number[];
  activePositionsCount: number;
  isLoading: boolean;
  error: string | null;
}
