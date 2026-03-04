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
