import { V1_SWAP_TOKENS } from '../constants/swapContracts.ts';
import type { SwapToken, SwapTokenSymbol } from '../types/swap.types.ts';

export function getSwapToken(symbol: SwapTokenSymbol): SwapToken {
  const token = V1_SWAP_TOKENS.find((item) => item.symbol === symbol);

  if (!token) {
    throw new Error(`Unsupported swap token: ${symbol}`);
  }

  return token;
}

export function getSwapTokenByAddress(address: string): SwapToken | undefined {
  const normalizedAddress = address.toLowerCase();

  return V1_SWAP_TOKENS.find((token) => {
    if (token.address?.toLowerCase() === normalizedAddress) return true;
    return token.wrappedAddress?.toLowerCase() === normalizedAddress;
  });
}
