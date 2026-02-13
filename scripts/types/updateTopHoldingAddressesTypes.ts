export type TopHoldingAddressesUpdateStrategy = 'multicall' | 'fallback';

export interface UpdateTopHoldingAddressesResult {
  updated: boolean;
  strategy: TopHoldingAddressesUpdateStrategy;
}
