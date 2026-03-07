import type { PranaStatsComputed } from '../types.ts';
import type { CapitalData } from './capital.types.ts';
import type { LpCapitalData } from './lpCapital.types.ts';

export type PranaStatsApiResponse = PranaStatsComputed;

export interface CapitalApiResponse {
  items: CapitalData['items'];
}

export type LpCapitalApiResponse = Omit<LpCapitalData, 'isLoading' | 'error'>;

export interface BondMetricsApiSide {
  v1CommittedRaw: string;
  v2CommittedRaw: string;
  v2BalanceRaw: string;
  totalBalanceRaw: string;
  totalCommittedRaw: string;
  totalVolumeRaw: string;
}

export interface BondMetricsApiResponse {
  buy: BondMetricsApiSide;
  sell: BondMetricsApiSide;
}
