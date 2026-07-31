/** 2^256 - 1 — max Solidity / ABI `uint256`. */
export const MAX_UINT256 = (1n << 256n) - 1n;

/** Decimal digit length of `MAX_UINT256` (no leading zeros). */
export const MAX_UINT256_DECIMAL_DIGITS = 78;

/**
 * Parse a canonical non-negative decimal integer string into a uint256 bigint.
 * Rejects non-strings, hex/floats/signs, leading zeros (except `"0"`),
 * overlong digit strings, and values above `MAX_UINT256`.
 */
export function parseUnsignedDecimalRaw(value: unknown): bigint | null {
  // Canonical form: "0" or a positive integer without leading zeros.
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) {
    return null;
  }

  // Cheap length guard before BigInt on huge digit strings near body cap.
  if (value.length > MAX_UINT256_DECIMAL_DIGITS) {
    return null;
  }

  const parsed = BigInt(value);
  if (parsed > MAX_UINT256) {
    return null;
  }

  return parsed;
}
