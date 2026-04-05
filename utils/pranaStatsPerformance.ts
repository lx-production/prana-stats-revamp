import type { PriceChangeSet } from '../types/performance.ts';
import type { PricePoint } from '../types/pricePoint.ts';
import { calcChange, getPerformanceCutoffs, getPriceAtOrAfter, getSatsPerformanceInputs } from './pranaStatsUtils.ts';

const ATL_PRICE = 0.0017;

type BuildFiatPriceChangeFrom365Params = {
  btcPriceUsd: number;
  latestSatPrice: number;
  d365: PricePoint[];
};

export const buildFiatPriceChangeFrom365 = ({
  btcPriceUsd,
  latestSatPrice,
  d365,
}: BuildFiatPriceChangeFrom365Params): PriceChangeSet => {
  const latestSatPriceUsd = (latestSatPrice / 1e8) * btcPriceUsd;
  const mockM1 = latestSatPriceUsd * 0.95;
  const mockM3 = latestSatPriceUsd * 0.8;
  const mockM6 = latestSatPriceUsd * 1.2;
  const mockY1 = latestSatPriceUsd * 0.5;
  const { m1Cutoff, m3Cutoff, m6Cutoff, y1Cutoff } = getPerformanceCutoffs();
  const getHistoricalPrice = (cutoffUnixSeconds: number, fallback: number) => {
    if (d365.length === 0) return fallback;

    const match = d365.find((point) => point.t >= cutoffUnixSeconds);
    return match?.p ?? d365[0].p;
  };

  return {
    m1: calcChange(getHistoricalPrice(m1Cutoff, mockM1), latestSatPriceUsd),
    m3: calcChange(getHistoricalPrice(m3Cutoff, mockM3), latestSatPriceUsd),
    m6: calcChange(getHistoricalPrice(m6Cutoff, mockM6), latestSatPriceUsd),
    y1: calcChange(getHistoricalPrice(y1Cutoff, mockY1), latestSatPriceUsd),
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
