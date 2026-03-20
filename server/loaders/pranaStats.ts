import type { PranaStatsApiResponse } from '../../types/api.types.ts';
import {
  calcChange,
  getFirstPrice,
  getPriceAtOrAfter,
  getSatsPerformanceInputs,
} from '../../utils/pranaStatsUtils.ts';
import { loadPranaPricesBundle } from './pranaPrices.ts';

const ATL_PRICE = 0.0017;

export async function loadPranaStats(): Promise<PranaStatsApiResponse> {
  const { btcPriceUsd, btcPriceVnd, usdToVndRate, latestSatPrice, satsData, d30, d90, d180, d365 } =
    await loadPranaPricesBundle();

  const pranaPriceVnd = (latestSatPrice / 1e8) * btcPriceVnd;
  const marketCap = Math.round(pranaPriceVnd * 1e7);

  const latestSatPriceUsd = (latestSatPrice / 1e8) * btcPriceUsd;
  const { parsedSatsData, m1Cutoff, m3Cutoff, m6Cutoff, y1Cutoff, safeSatsAtl } =
    getSatsPerformanceInputs(satsData, latestSatPrice);

  const mockM1 = latestSatPriceUsd * 0.95;
  const mockM3 = latestSatPriceUsd * 0.8;
  const mockM6 = latestSatPriceUsd * 1.2;
  const mockY1 = latestSatPriceUsd * 0.5;

  return {
    btcPriceUsd,
    btcPriceVnd,
    usdToVndRate,
    latestSatPrice,
    marketCapVnd: marketCap,
    priceChange: {
      m1: calcChange(getFirstPrice(d30, mockM1), latestSatPriceUsd),
      m3: calcChange(getFirstPrice(d90, mockM3), latestSatPriceUsd),
      m6: calcChange(getFirstPrice(d180, mockM6), latestSatPriceUsd),
      y1: calcChange(getFirstPrice(d365, mockY1), latestSatPriceUsd),
      atl: calcChange(ATL_PRICE, latestSatPriceUsd),
    },
    priceChangeBtc: {
      m1: calcChange(getPriceAtOrAfter(parsedSatsData, m1Cutoff, latestSatPrice), latestSatPrice),
      m3: calcChange(getPriceAtOrAfter(parsedSatsData, m3Cutoff, latestSatPrice), latestSatPrice),
      m6: calcChange(getPriceAtOrAfter(parsedSatsData, m6Cutoff, latestSatPrice), latestSatPrice),
      y1: calcChange(getPriceAtOrAfter(parsedSatsData, y1Cutoff, latestSatPrice), latestSatPrice),
      atl: calcChange(safeSatsAtl, latestSatPrice),
    },
  };
}
