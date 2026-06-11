import { PranaStatsData } from '../types';

export const initialPranaStats: PranaStatsData = {
  btcPriceUsd: null,
  btcPriceVnd: null,
  usdToVndRate: null,
  latestSatPrice: null,
  marketCapVnd: null,
  priceChange: { m1: 0, m3: 0, m6: 0, y1: 0, atl: 0 },
  priceChangeBtc: { m1: 0, m3: 0, m6: 0, y1: 0, y2: 0, atl: 0 },
  isLoading: true,
  error: null
};
