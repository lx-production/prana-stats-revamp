import type { ComputedSupplyMetrics, SupplyMetricsHolder } from '../types/supplyMetrics.types';

export const PRANA_TOTAL_SUPPLY = 10_000_000;

const NON_CIRCULATING_RANKS = new Set([1, 2, 3, 5]);
const BUYABLE_LABELS = new Set(['WBTC/PRANA DEX Pool', 'DEX Pool & Bonds Reserve']);

function toFiniteNumber(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function computeSupplyMetrics(
  holders: SupplyMetricsHolder[],
  buyBondCapacityDisplay: string | null,
): ComputedSupplyMetrics {
  const nonCirculating = holders.reduce((sum, holder, index) => {
    const rank = index + 1;
    if (!NON_CIRCULATING_RANKS.has(rank)) return sum;
    return sum + toFiniteNumber(holder.balance);
  }, 0);

  const remaining = PRANA_TOTAL_SUPPLY - nonCirculating;
  const circulatingSupply = Number.isFinite(remaining) ? Math.max(0, remaining) : 0;

  const poolTotal = holders.reduce((sum, holder) => {
    if (!BUYABLE_LABELS.has(holder.label)) return sum;
    return sum + toFiniteNumber(holder.balance);
  }, 0);

  const capacityPranaRaw = typeof buyBondCapacityDisplay === 'string'
    ? Number(buyBondCapacityDisplay.replace(/,/g, ''))
    : 0;
  const capacityPrana = Number.isFinite(capacityPranaRaw) ? capacityPranaRaw : 0;
  const total = poolTotal + capacityPrana;
  const buyableSupply = Number.isFinite(total) ? total : 0;

  return { circulatingSupply, buyableSupply };
}
