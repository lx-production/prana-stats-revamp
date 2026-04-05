import type { PranaStatsApiResponse } from '../../types/api.types.ts';
import { loadPranaPricesBundle } from './pranaPrices.ts';

export async function loadPranaStats(): Promise<PranaStatsApiResponse> {
  const { btcPriceUsd, btcPriceVnd, usdToVndRate, latestSatPrice } = await loadPranaPricesBundle();

  const pranaPriceVnd = (latestSatPrice / 1e8) * btcPriceVnd;
  const marketCap = Math.round(pranaPriceVnd * 1e7);

  return {
    btcPriceUsd,
    btcPriceVnd,
    usdToVndRate,
    latestSatPrice,
    marketCapVnd: marketCap,
  };
}
