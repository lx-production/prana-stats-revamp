/**
 * Pure bigint ↔ decimal helpers.
 * No ethers, viem, React, or feature types — safe for homepage and server.
 */

/**
 * Decimal string matching ethers.formatUnits(value, decimals):
 * trims trailing fractional zeros but keeps at least one digit when decimals > 0.
 */
export function formatUnitsToString(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;

  if (decimals <= 0) {
    return negative ? `-${abs.toString()}` : abs.toString();
  }

  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const fraction = abs % divisor;

  // Pad then trim trailing zeros; keep a single `0` when the fraction is empty
  let fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  if (!fractionStr) fractionStr = '0';

  const formatted = `${whole.toString()}.${fractionStr}`;
  return negative ? `-${formatted}` : formatted;
}

/**
 * Match parseFloat(ethers.formatUnits(value, decimals)) without importing ethers/viem.
 */
export function formatTokenFloatFromRaw(value: bigint, decimals: number): number {
  return parseFloat(formatUnitsToString(value, decimals));
}
