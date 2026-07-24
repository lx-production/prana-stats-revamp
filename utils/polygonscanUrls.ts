import { POLYGONSCAN_TOKEN_BASE_URL } from '../constants/network.ts';

/** Build a Polygonscan token page URL (optional holder filter or hash fragment). */
export function buildPolygonscanTokenUrl(
  tokenAddress: string,
  options?: { holderAddress?: string; hash?: string },
): string {
  const base = `${POLYGONSCAN_TOKEN_BASE_URL}/${tokenAddress}`;

  if (options?.holderAddress) {
    return `${base}?a=${options.holderAddress}`;
  }

  if (options?.hash) {
    return `${base}#${options.hash}`;
  }

  return base;
}
