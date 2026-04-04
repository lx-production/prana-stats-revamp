/** Matches server `USD_TO_VND_FALLBACK` in `server/loaders/pranaPrices.ts` when API rate is unavailable. */
export const USD_TO_VND_CHART_FALLBACK = 27_000;

export function resolveUsdToVndRateForChart(usdToVndRate: number | null | undefined): number {
  if (typeof usdToVndRate === 'number' && Number.isFinite(usdToVndRate) && usdToVndRate > 0) {
    return usdToVndRate;
  }
  return USD_TO_VND_CHART_FALLBACK;
}
