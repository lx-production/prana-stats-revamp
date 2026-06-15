import type { PricePoint } from '../types/pricePoint.ts';
import type { PriceChangeSet } from '../types/performance.ts';
import { calcChange, getPerformanceCutoffs, getPriceAtOrAfter } from './pranaStatsUtils.ts';

const ATL_PRICE = 0.0017;

type BuildFiatPriceChangeParams = {
  btcPriceUsd: number;
  latestSatPrice: number;
  usdHistory: PricePoint[];
};

export const buildFiatPriceChange = ({
  btcPriceUsd,
  latestSatPrice, // “live-ish now” performance (more real-time anchor)
  usdHistory,
}: BuildFiatPriceChangeParams): PriceChangeSet => {
  const latestSatPriceUsd = (latestSatPrice / 1e8) * btcPriceUsd;
  const { m1Cutoff, m3Cutoff, m6Cutoff, y1Cutoff, y2Cutoff } = getPerformanceCutoffs();

  return {
    m1: calcChange(getPriceAtOrAfter(usdHistory, m1Cutoff, latestSatPriceUsd), latestSatPriceUsd),
    m3: calcChange(getPriceAtOrAfter(usdHistory, m3Cutoff, latestSatPriceUsd), latestSatPriceUsd),
    m6: calcChange(getPriceAtOrAfter(usdHistory, m6Cutoff, latestSatPriceUsd), latestSatPriceUsd),
    y1: calcChange(getPriceAtOrAfter(usdHistory, y1Cutoff, latestSatPriceUsd), latestSatPriceUsd),
    y2: calcChange(getPriceAtOrAfter(usdHistory, y2Cutoff, latestSatPriceUsd), latestSatPriceUsd),
    atl: calcChange(ATL_PRICE, latestSatPriceUsd),
  };
};

export const buildBtcPriceChange = (latestSatPrice: number, satsData: PricePoint[]): PriceChangeSet => {
  const { m1Cutoff, m3Cutoff, m6Cutoff, y1Cutoff, y2Cutoff } = getPerformanceCutoffs();
  const satsAtl = 21.83;
  const safeSatsAtl = Number.isFinite(satsAtl) ? satsAtl : latestSatPrice;

  return {
    m1: calcChange(getPriceAtOrAfter(satsData, m1Cutoff, latestSatPrice), latestSatPrice),
    m3: calcChange(getPriceAtOrAfter(satsData, m3Cutoff, latestSatPrice), latestSatPrice),
    m6: calcChange(getPriceAtOrAfter(satsData, m6Cutoff, latestSatPrice), latestSatPrice),
    y1: calcChange(getPriceAtOrAfter(satsData, y1Cutoff, latestSatPrice), latestSatPrice),
    y2: calcChange(getPriceAtOrAfter(satsData, y2Cutoff, latestSatPrice), latestSatPrice),
    atl: calcChange(safeSatsAtl, latestSatPrice),
  };
};
