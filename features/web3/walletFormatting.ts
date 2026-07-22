/**
 * Pure wallet display helpers — no Wagmi/viem imports.
 * Shared by Swap and staking UI without pulling Web3 runtime.
 */

/** Shorten a hex address to `0xABCD...WXYZ` (first 6 + last 4 chars). */
export function formatCompactAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
