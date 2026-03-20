import type { BondStatsComputed, PranaStatsComputed, StakingStatsComputed } from '../types.ts';
import type { CapitalData } from './capital.types.ts';
import type { LpCapitalData } from './lpCapital.types.ts';
import type { BondingStatsOutput } from '../types.ts';

export type PranaStatsApiResponse = PranaStatsComputed;
export type StakingStatsApiResponse = StakingStatsComputed;

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
  summary: BondStatsComputed;
}
