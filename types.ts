import type { JsonRpcProvider } from 'ethers';

// Types and interfaces for the Prana Stats application

export type BondTotalsCacheEntry = {
  total: bigint;
  timestamp: number;
};

export type BondsV2Json = {
  buy?: {
    address?: string;
    pranaAmount?: string;
  };
  sell?: {
    address?: string;
    pranaAmount?: string;
  };
};

export interface PranaStatsData {
  // Pricing inputs (used by converter and derived stats)
  btcPriceUsd: number | null;
  btcPriceVnd: number | null;
  usdToVndRate: number | null;
  latestSatPrice: number | null;

  marketCapVnd: number | null;
  priceChange: {
    m1: number;
    m3: number;
    m6: number;
    y1: number;
    atl: number;
  };
  priceChangeBtc: {
    m1: number;
    m3: number;
    m6: number;
    y1: number;
    atl: number;
  };
  isLoading: boolean;
  error: string | null;
}

export type PranaStatsComputed = Omit<PranaStatsData, 'isLoading' | 'error'>;

export interface BondStatsData {
  buyBondPrana: number | null;
  buyBondVnd: number | null;
  sellBondPrana: number | null;
  sellBondVnd: number | null;
  buyBondBalanceDisplay: string | null;
  buyBondCommittedDisplay: string | null;
  buyBondCapacityDisplay: string | null;
  buyBondCommittedPercent: number | null;
  buyBondCapacityPercent: number | null;
  sellBondBalanceDisplay: string | null;
  sellBondCommittedDisplay: string | null;
  sellBondCapacityDisplay: string | null;
  sellBondCommittedPercent: number | null;
  sellBondCapacityPercent: number | null;
  isLoading: boolean;
  error: string | null;
}

export type BondStatsComputed = Omit<BondStatsData, 'isLoading' | 'error'>;

export interface StakingStatsData {
  stakedPrana: number | null;
  stakedVnd: number | null;
  interestContractBalancePrana: number | null;
  interestContractBalanceVnd: number | null;
  interestPrana: number | null;
  interestVnd: number | null;
  isLoading: boolean;
  error: string | null;
}

export type StakingStatsComputed = Omit<StakingStatsData, 'isLoading' | 'error'>;

export interface PranaPricesData {
  btcPriceUsd: number | null;
  btcPriceVnd: number | null;
  usdToVndRate: number | null;
  latestSatPrice: number | null;
  isLoading: boolean;
  error: string | null;
}

export type PranaPricesBundle = {
  btcPriceUsd: number;
  btcPriceVnd: number;
  usdToVndRate: number;
  latestSatPrice: number;
  satsData: any[];
  d30: any[];
  d90: any[];
  d180: any[];
  d365: any[];
};

export interface StatCardProps {
  title: string;
  mainValue: React.ReactNode;
  subValue?: string;
  icon?: React.ElementType;
  delay?: number;
  className?: string;
  loading?: boolean;
  highlight?: boolean;
  footer?: React.ReactNode;
}

export interface BondProgressValues {
  committedPercent?: number | null;
  capacityPercent?: number | null;
}

export interface BondProgressBarProps extends BondProgressValues {
  loading: boolean;
  committedValue?: string;
  capacityValue?: string;
  unit: string;
}

export interface BondingStatsInput {
  buyCommittedV1: bigint;
  buyCommittedV2: bigint;
  buyBalanceV2: bigint;
  sellCommittedV1: bigint;
  sellCommittedV2: bigint;
  sellBalanceV2: bigint;
  buyBondTotalRawV2: bigint;
  sellBondTotalRawV2: bigint;
  buyBondV1TotalRaw: bigint;
  sellBondV1TotalRaw: bigint;
  pranaPriceVnd: number;
}

export interface BondingStatsOutput {
  buyBondPrana: number;
  buyBondVnd: number;
  sellBondPrana: number;
  sellBondVnd: number;
  buyBondBalanceDisplay: string;
  buyBondCommittedDisplay: string;
  buyBondCapacityDisplay: string;
  buyBondCommittedPercent: number;
  buyBondCapacityPercent: number;
  sellBondBalanceDisplay: string;
  sellBondCommittedDisplay: string;
  sellBondCapacityDisplay: string;
  sellBondCommittedPercent: number;
  sellBondCapacityPercent: number;
}

export interface StakingStatsOutput {
  stakedPrana: number;
  interestContractBalancePrana: number;
  interestPrana: number;
}

export interface FetchStakingStatsParams {
  provider: JsonRpcProvider;
}

export type FetchStakingStats = (
  params: FetchStakingStatsParams
) => Promise<StakingStatsOutput>;

export interface TopHoldingAddressBalance {
  address: string;
  label: string;
  balanceRaw: string;
  balance: string;
}

export interface TopHoldingAddressesBuildOutputParams {
  balancesRaw: bigint[];
  rpcUrl: string;
}

export interface TopHoldingAddressesBuildOutput {
  generatedAt: string;
  rpcUrl: string;
  token: {
    address: string;
    symbol: string;
    decimals: number;
  };
  holders: TopHoldingAddressBalance[];
}

export interface TopHoldingAddressesJson {
  generatedAt?: string;
  token?: {
    address?: string;
    symbol?: string;
    decimals?: number;
  };
  holders?: TopHoldingAddressBalance[];
}

export interface TopHoldingAddressesData {
  holders: TopHoldingAddressBalance[];
  allHolders?: TopHoldingAddressBalance[];
  totalHolders: number;
  generatedAt: string | null;
  currentPage: number;
  totalPages: number;
  startIndex: number;
  goToPage: (page: number) => void;
  isLoading: boolean;
  error: string | null;
}
