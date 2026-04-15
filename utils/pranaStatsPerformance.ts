import type { PricePoint } from '../types/pricePoint.ts';
import type { PriceChangeSet } from '../types/performance.ts';
import { calcChange, getPerformanceCutoffs, getPriceAtOrAfter, getSatsPerformanceInputs } from './pranaStatsUtils.ts';

const ATL_PRICE = 0.0017;

type BuildFiatPriceChangeFrom365Params = {
  btcPriceUsd: number;
  latestSatPrice: number;
  d365: PricePoint[];
};

export const buildFiatPriceChangeFrom365 = ({
  btcPriceUsd,
  latestSatPrice, // “live-ish now” performance (more real-time anchor)
  d365,
}: BuildFiatPriceChangeFrom365Params): PriceChangeSet => {
  const latestSatPriceUsd = (latestSatPrice / 1e8) * btcPriceUsd;
  const { m1Cutoff, m3Cutoff, m6Cutoff, y1Cutoff } = getPerformanceCutoffs();

  return {
    m1: calcChange(getPriceAtOrAfter(d365, m1Cutoff, latestSatPriceUsd), latestSatPriceUsd),
    m3: calcChange(getPriceAtOrAfter(d365, m3Cutoff, latestSatPriceUsd), latestSatPriceUsd),
    m6: calcChange(getPriceAtOrAfter(d365, m6Cutoff, latestSatPriceUsd), latestSatPriceUsd),
    y1: calcChange(getPriceAtOrAfter(d365, y1Cutoff, latestSatPriceUsd), latestSatPriceUsd),
    atl: calcChange(ATL_PRICE, latestSatPriceUsd),
  };
};

export const buildBtcPriceChange = (latestSatPrice: number, satsData: PricePoint[]): PriceChangeSet => {
  const { parsedSatsData, m1Cutoff, m3Cutoff, m6Cutoff, y1Cutoff, safeSatsAtl } =
    getSatsPerformanceInputs(satsData, latestSatPrice);

  return {
    m1: calcChange(getPriceAtOrAfter(parsedSatsData, m1Cutoff, latestSatPrice), latestSatPrice),
    m3: calcChange(getPriceAtOrAfter(parsedSatsData, m3Cutoff, latestSatPrice), latestSatPrice),
    m6: calcChange(getPriceAtOrAfter(parsedSatsData, m6Cutoff, latestSatPrice), latestSatPrice),
    y1: calcChange(getPriceAtOrAfter(parsedSatsData, y1Cutoff, latestSatPrice), latestSatPrice),
    atl: calcChange(safeSatsAtl, latestSatPrice),
  };
};
