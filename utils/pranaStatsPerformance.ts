import type { PranaPriceChanges, PriceChangeSet } from '../types/performance.ts';
import { calcChange, getFirstPrice, getPriceAtOrAfter, getSatsPerformanceInputs } from './pranaStatsUtils.ts';

const ATL_PRICE = 0.0017;

type BuildPranaPriceChangesParams = {
  btcPriceUsd: number;
  latestSatPrice: number;
  satsData: unknown;
  d30: Array<{ p?: number }>;
  d90: Array<{ p?: number }>;
  d180: Array<{ p?: number }>;
  d365: Array<{ p?: number }>;
};

const buildFiatPriceChange = (
  latestSatPriceUsd: number,
  d30: Array<{ p?: number }>,
  d90: Array<{ p?: number }>,
  d180: Array<{ p?: number }>,
  d365: Array<{ p?: number }>,
): PriceChangeSet => {
  const mockM1 = latestSatPriceUsd * 0.95;
  const mockM3 = latestSatPriceUsd * 0.8;
  const mockM6 = latestSatPriceUsd * 1.2;
  const mockY1 = latestSatPriceUsd * 0.5;

  return {
    m1: calcChange(getFirstPrice(d30, mockM1), latestSatPriceUsd),
    m3: calcChange(getFirstPrice(d90, mockM3), latestSatPriceUsd),
    m6: calcChange(getFirstPrice(d180, mockM6), latestSatPriceUsd),
    y1: calcChange(getFirstPrice(d365, mockY1), latestSatPriceUsd),
    atl: calcChange(ATL_PRICE, latestSatPriceUsd),
  };
};

const buildBtcPriceChange = (latestSatPrice: number, satsData: unknown): PriceChangeSet => {
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

export const buildPranaPriceChanges = ({
  btcPriceUsd,
  latestSatPrice,
  satsData,
  d30,
  d90,
  d180,
  d365,
}: BuildPranaPriceChangesParams): PranaPriceChanges => {
  const latestSatPriceUsd = (latestSatPrice / 1e8) * btcPriceUsd;

  return {
    priceChange: buildFiatPriceChange(latestSatPriceUsd, d30, d90, d180, d365),
    priceChangeBtc: buildBtcPriceChange(latestSatPrice, satsData),
  };
};
