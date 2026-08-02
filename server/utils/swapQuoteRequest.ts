import { ethers } from 'ethers';

import { getSwapToken } from '../../utils/swapTokens.ts';
import { getValidatedSlippageBps } from './swapQuoteUtils.ts';
import { V1_SWAP_TOKENS } from '../../constants/swapContracts.ts';

import type { HexAddress, SwapQuoteRequest, SwapTokenSymbol } from '../../types/swap.types.ts';

const SWAP_TOKEN_SYMBOLS = new Set<string>(V1_SWAP_TOKENS.map((token) => token.symbol));

/** True when value is one of the V1 allowlisted swap symbols. */
function isSwapTokenSymbol(value: unknown): value is SwapTokenSymbol {
  return typeof value === 'string' && SWAP_TOKEN_SYMBOLS.has(value);
}

/**
 * Validate POST /api/swap/quote JSON before spending the scarce quote RPC budget.
 * Normalizes slippage into the server clamp range. Amount/token checks mirror loadSwapQuote.
 */
export function parseSwapQuoteRequest(body: unknown): SwapQuoteRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid swap quote request.');
  }

  const payload = body as Record<string, unknown>;

  if (!isSwapTokenSymbol(payload.tokenInSymbol) || !isSwapTokenSymbol(payload.tokenOutSymbol)) {
    throw new Error('Unsupported swap token.');
  }

  const tokenIn = getSwapToken(payload.tokenInSymbol);
  const tokenOut = getSwapToken(payload.tokenOutSymbol);

  if (tokenIn.symbol === tokenOut.symbol) {
    throw new Error('Choose two different tokens.');
  }

  if (typeof payload.recipient !== 'string' || !ethers.isAddress(payload.recipient)) {
    throw new Error('Connect a valid wallet address.');
  }

  if (typeof payload.amountIn !== 'string') {
    throw new Error('Enter an amount greater than zero.');
  }

  let amountInRaw: bigint;
  try {
    amountInRaw = ethers.parseUnits(payload.amountIn, tokenIn.decimals);
  } catch {
    throw new Error('Enter an amount greater than zero.');
  }

  if (amountInRaw <= 0n) {
    throw new Error('Enter an amount greater than zero.');
  }

  // Non-finite slippage falls back inside getValidatedSlippageBps (same as quote loader).
  const slippageBps =
    typeof payload.slippageBps === 'number'
      ? getValidatedSlippageBps(payload.slippageBps)
      : getValidatedSlippageBps(Number.NaN);

  return {
    tokenInSymbol: payload.tokenInSymbol,
    tokenOutSymbol: payload.tokenOutSymbol,
    amountIn: payload.amountIn,
    recipient: payload.recipient as HexAddress,
    slippageBps,
  };
}
