import { formatUnits, parseUnits } from 'viem';
import type { SwapToken } from '../types/swap.types';

export function parseSwapTokenAmount(amount: string, token: SwapToken): bigint {
  const normalizedAmount = amount.trim();

  if (!normalizedAmount || Number(normalizedAmount) <= 0) return 0n;

  return parseUnits(normalizedAmount, token.decimals);
}

export function formatSwapTokenAmount(rawAmount: bigint | string, token: SwapToken, fractionDigits = 6): string {
  const value = typeof rawAmount === 'bigint' ? rawAmount : BigInt(rawAmount || '0');
  const formatted = formatUnits(value, token.decimals);
  const numeric = Number(formatted);

  if (!Number.isFinite(numeric)) return formatted;
  if (numeric === 0) return '0';
  if (numeric < 0.000001) return '<0.000001';

  return numeric.toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
  });
}

export function isPositiveDecimalInput(value: string): boolean {
  return /^\d*(?:\.\d*)?$/.test(value);
}
