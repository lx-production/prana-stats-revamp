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
  stakedPrana: number | null;
  stakedVnd: number | null;
  interestContractBalancePrana: number | null;
  interestContractBalanceVnd: number | null;
  interestPrana: number | null;
  interestVnd: number | null;
  buyBondPrana: number | null;
  buyBondVnd: number | null;
  sellBondPrana: number | null;
  sellBondVnd: number | null;
  priceChange: {
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

export interface StatCardProps {
  title: string;
  mainValue: string | number;
  subValue?: string;
  icon?: React.ElementType;
  delay?: number;
  className?: string;
  loading?: boolean;
  highlight?: boolean;
  footer?: React.ReactNode;
}