import type { PranaStatsApiResponse } from '../../types/api.types.ts';
import { loadPranaPricesBundle } from './pranaPrices.ts';
import { buildPranaPriceChanges } from '../../utils/pranaStatsPerformance.ts';

export async function loadPranaStats(): Promise<PranaStatsApiResponse> {
  const { btcPriceUsd, btcPriceVnd, usdToVndRate, latestSatPrice, satsData, d30, d90, d180, d365 } =
    await loadPranaPricesBundle();

  const pranaPriceVnd = (latestSatPrice / 1e8) * btcPriceVnd;
  const marketCap = Math.round(pranaPriceVnd * 1e7);
  
  const { priceChange, priceChangeBtc } = buildPranaPriceChanges({
    btcPriceUsd,
    latestSatPrice,
    satsData,
    d30,
    d90,
    d180,
    d365,
  });

  return {
    btcPriceUsd,
    btcPriceVnd,
    usdToVndRate,
    latestSatPrice,
    marketCapVnd: marketCap,
    priceChange,
    priceChangeBtc,
  };
}
