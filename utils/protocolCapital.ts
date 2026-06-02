import type { CapitalItem } from '../types/capital.types';

function toFiniteNumber(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function computeProtocolCapitalUsd(
  items: CapitalItem[],
  lpUsdValueNumber: unknown,
): number {
  const capitalTotal = items.reduce((sum, item) => {
    if (item.tokenSymbol === 'USDT') return sum + toFiniteNumber(item.amountValue);
    if (item.tokenSymbol === 'WBTC') return sum + toFiniteNumber(item.usdValueNumber);
    return sum;
  }, 0);

  return capitalTotal + toFiniteNumber(lpUsdValueNumber);
}
