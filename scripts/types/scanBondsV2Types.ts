export type BondEntry = Record<string, unknown> & { index: number };

export interface ScanResult {
  count: number;
  pranaAmount: string;
  bonds: BondEntry[];
}

export interface BondSummary {
  address: string;
  pranaAmount: string;
}

export interface BondDetails extends BondSummary {
  count: number;
  bonds: BondEntry[];
}

export interface BondsSummaryOutput {
  generatedAt: string;
  rpcUrl: string;
  buy: BondSummary;
  sell: BondSummary;
}

export interface BondsDetailsOutput {
  generatedAt: string;
  rpcUrl: string;
  buy: BondDetails;
  sell: BondDetails;
}
