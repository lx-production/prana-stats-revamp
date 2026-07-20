import { ethers } from 'ethers';

import type { Address } from '../../types/blockchain.types.ts';

/**
 * Validate + EIP-55 checksum an address string.
 * Returns null when the input is missing or not a valid address.
 */
export function parseChecksumAddress(value: string | null | undefined): Address | null {
  if (!value || !ethers.isAddress(value)) return null;
  return ethers.getAddress(value) as Address;
}
