export interface BondContractRef {
  address?: string;
}

export interface UseTotalV2BondPranaVolumeParams {
  contracts?: BondContractRef[];
}

export interface UseTotalV2BondPranaVolumeResult {
  totalPranaRaw: bigint;
  isLoading: boolean;
  error: unknown | null;
}
