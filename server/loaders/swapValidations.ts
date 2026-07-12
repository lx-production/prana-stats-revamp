import { ethers } from 'ethers';
import { SWAP_ROUTER_02_ABI, UNISWAP_SWAP_ROUTER_02_ADDRESS } from '../../constants/swapContracts.ts';

import type { HexAddress, SwapQuoteRequest, SwapToken, SwapTransactionCandidate, SwapValidationContext } from '../../types/swap.types.ts';

/**
 * Decode and validate SwapRouter02 calldata before a quote is returned to the client.
 * Rejects wrong recipients, wrong amounts, unexpected methods, or nested multicalls we don't understand.
 */

// Shared ABI decoder for SwapRouter02 calldata (encoding + validation).
export const SWAP_ROUTER_IFACE = new ethers.Interface(SWAP_ROUTER_02_ABI);
const ROUTER_ADDRESS_LOWER = UNISWAP_SWAP_ROUTER_02_ADDRESS.toLowerCase();

// SwapRouter02 sentinel recipients (not real wallets):
// - msg.sender → pay the EOA that submitted the tx
// - address(this) → keep funds on the router for a later unwrap/sweep in the same multicall
const SWAP_ROUTER_MSG_SENDER_RECIPIENT = '0x0000000000000000000000000000000000000001';
const SWAP_ROUTER_ADDRESS_THIS_RECIPIENT = '0x0000000000000000000000000000000000000002';

/** Tracks how much input has been spent across nested multicall legs. */
type SwapInputBudget = {
  spentRaw: bigint;
};

/** Address used on-chain for swaps: ERC-20 address, or wrapped address for native POL. */
function tokenExecutionAddress(token: SwapToken): string {
  const address = token.address ?? token.wrappedAddress;
  if (!address) throw new Error(`${token.symbol} is missing an execution address.`);
  return address.toLowerCase();
}

/**
 * Recipients we allow in router calldata:
 * - the user’s requested recipient
 * - the router itself
 * - SwapRouter02 sentinel addresses (msg.sender / address(this))
 */
function isAllowedRecipient(address: string, request: SwapQuoteRequest): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === request.recipient.toLowerCase() ||
    normalized === ROUTER_ADDRESS_LOWER ||
    normalized === SWAP_ROUTER_MSG_SENDER_RECIPIENT ||
    normalized === SWAP_ROUTER_ADDRESS_THIS_RECIPIENT
  );
}

/**
 * Unpack a V3 packed path into just the token addresses.
 * Layout: 20-byte address, then repeating (3-byte fee + 20-byte address).
 */
function decodeV3PathAddresses(path: string): string[] {
  const normalized = path.toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(normalized) || normalized.length < 42) {
    throw new Error('Uniswap returned an invalid V3 path.');
  }

  // First token: chars after "0x" are 40 hex chars (20 bytes).
  const addresses = [`0x${normalized.slice(2, 42)}`];
  let offset = 42;

  while (offset < normalized.length) {
    offset += 6; // skip uint24 pool fee (3 bytes = 6 hex chars)
    if (offset + 40 > normalized.length) {
      throw new Error('Uniswap returned an invalid V3 path.');
    }
    addresses.push(`0x${normalized.slice(offset, offset + 40)}`);
    offset += 40;
  }

  return addresses;
}

/** In strict mode, first/last path tokens must match the requested pair. */
function validatePathEndpoints(pathAddresses: string[], context: SwapValidationContext): void {
  // In non-strict mode, we don’t care about the first/last path tokens matching the requested pair
  if (!context.strictPath) return;

  const first = pathAddresses[0]?.toLowerCase();
  const last = pathAddresses[pathAddresses.length - 1]?.toLowerCase();

  if (first !== tokenExecutionAddress(context.tokenIn) || last !== tokenExecutionAddress(context.tokenOut)) {
    throw new Error('Uniswap returned a route for the wrong token pair.');
  }
}

/** Add this call’s input to the running budget; reject if we exceed the user’s amountIn. */
function spendInputBudget(amountIn: bigint, context: SwapValidationContext, inputBudget: SwapInputBudget): void {
  inputBudget.spentRaw += amountIn;

  if (inputBudget.spentRaw > context.amountInRaw) {
    throw new Error('Uniswap returned calldata with too much cumulative input.');
  }
}

/**
 * Recursively decode SwapRouter02 calldata and assert it matches the quote request.
 * Handles: multicall (nested), exactInput, exactInputSingle, V2 swapExactTokensForTokens,
 * and safe “cleanup” methods (unwrap / sweep / wrap / refund).
 * Anything else is rejected — we only ship calldata we understand.
 */
function validateRouterCall(
  data: HexAddress,
  context: SwapValidationContext,
  inputBudget: SwapInputBudget,
  depth = 0,
): void {
  // Guard against pathological nesting (multicall inside multicall …).
  if (depth > 4) throw new Error('Uniswap returned nested calldata that is too deep.');

  const parsed = SWAP_ROUTER_IFACE.parseTransaction({ data });
  if (!parsed) throw new Error('Uniswap returned unsupported router calldata.');

  // Outer wrapper: multicall(deadline, calls[]) — deadline must match what we asked for.
  if (parsed.name === 'multicall') {
    if (parsed.args.length !== 2) {
      throw new Error('Uniswap returned multicall calldata without a deadline.');
    }

    const calls = Array.from(parsed.args[1]);

    const txDeadline = BigInt(parsed.args[0].toString());
    if (txDeadline !== BigInt(context.deadline)) {
      throw new Error('Uniswap returned calldata with an unexpected deadline.');
    }

    if (!calls.length) {
      throw new Error('Uniswap returned an empty multicall.');
    }

    // Validate each inner call with the same shared input budget.
    calls.forEach((call) => validateRouterCall(call as HexAddress, context, inputBudget, depth + 1));
    return;
  }

  // Multi-hop V3 swap: path bytes + amountIn + amountOutMinimum + recipient.
  if (parsed.name === 'exactInput') {
    const params = parsed.args[0];
    const amountIn = BigInt(params.amountIn.toString());
    const amountOutMinimum = BigInt(params.amountOutMinimum.toString());
    const pathAddresses = decodeV3PathAddresses(params.path);

    if (!isAllowedRecipient(params.recipient, context.request)) {
      throw new Error('Uniswap returned calldata for an unexpected recipient.');
    }

    if (context.strictPath) {
      // Single-leg quote: amounts and path ends must match exactly.
      if (amountIn !== context.amountInRaw || amountOutMinimum !== context.minimumAmountOutRaw) {
        throw new Error('Uniswap returned calldata with unexpected amounts.');
      }
      validatePathEndpoints(pathAddresses, context);
    } else if (amountIn > context.amountInRaw) {
      // Multi-leg: each leg may use less than total input, but never more.
      throw new Error('Uniswap returned calldata with too much input.');
    }

    spendInputBudget(amountIn, context, inputBudget);
    return;
  }

  // Single-pool V3 swap: tokenIn/tokenOut/fee instead of a packed path.
  if (parsed.name === 'exactInputSingle') {
    const params = parsed.args[0];
    const amountIn = BigInt(params.amountIn.toString());
    const amountOutMinimum = BigInt(params.amountOutMinimum.toString());

    if (!isAllowedRecipient(params.recipient, context.request)) {
      throw new Error('Uniswap returned calldata for an unexpected recipient.');
    }

    if (context.strictPath) {
      if (
        params.tokenIn.toLowerCase() !== tokenExecutionAddress(context.tokenIn) ||
        params.tokenOut.toLowerCase() !== tokenExecutionAddress(context.tokenOut) ||
        amountIn !== context.amountInRaw ||
        amountOutMinimum !== context.minimumAmountOutRaw
      ) {
        throw new Error('Uniswap returned calldata with unexpected exactInputSingle params.');
      }
    } else if (amountIn > context.amountInRaw) {
      throw new Error('Uniswap returned calldata with too much input.');
    }

    spendInputBudget(amountIn, context, inputBudget);
    return;
  }

  // Uniswap V2-style path swap (AlphaRouter may mix V2 legs in).
  if (parsed.name === 'swapExactTokensForTokens') {
    const [amountIn, , path, to] = parsed.args;
    const inputAmount = BigInt(amountIn.toString());

    if (!isAllowedRecipient(to, context.request)) {
      throw new Error('Uniswap returned calldata for an unexpected recipient.');
    }

    const normalizedPathInput = Array.from(path as string[]);
    if (normalizedPathInput.length < 2) {
      throw new Error('Uniswap returned an invalid V2 path.');
    }

    if (context.strictPath) {
      const normalizedPath = normalizedPathInput.map((address: string) => address.toLowerCase());
      validatePathEndpoints(normalizedPath, context);
      if (inputAmount !== context.amountInRaw) {
        throw new Error('Uniswap returned calldata with unexpected V2 input.');
      }
    } else if (inputAmount > context.amountInRaw) {
      throw new Error('Uniswap returned calldata with too much input.');
    }

    spendInputBudget(inputAmount, context, inputBudget);
    return;
  }

  // Post-swap cleanup: unwrap WMATIC / sweep leftover tokens to the user (or allowed sentinel).
  if (parsed.name === 'unwrapWETH9' || parsed.name === 'sweepToken') {
    const maybeRecipient = parsed.args.length >= 2 ? parsed.args[parsed.args.length - 1] : undefined;
    if (typeof maybeRecipient === 'string' && !isAllowedRecipient(maybeRecipient, context.request)) {
      throw new Error('Uniswap returned calldata for an unexpected payment recipient.');
    }
    return;
  }

  // Native POL helpers — no recipient / amount checks beyond what the outer tx value covers.
  if (parsed.name === 'wrapETH' || parsed.name === 'refundETH') return;

  throw new Error('Uniswap returned unsupported router calldata.');
}

/**
 * Top-level safety check before we return a quote tx to the client:
 * - `to` must be SwapRouter02
 * - `value` must be amountIn for native POL, else 0
 * - calldata must pass validateRouterCall
 * - context starts from the UI request (tokens, amount, recipient, slippage), 
 * - plus a few values the server adds from the same quote (e.g. amountInRaw, deadline, minimumAmountOutRaw)
 * - transaction is the quoter/router’s proposed SwapRouter02 tx (to / data / value) 
 * - AlphaRouter’s methodParameters, or our hand-built fallback calldata
 */
export function validateSwapTransaction(transaction: SwapTransactionCandidate, context: SwapValidationContext): void {
  if (transaction.to.toLowerCase() !== ROUTER_ADDRESS_LOWER) {
    throw new Error('Uniswap returned an unexpected router address.');
  }

  const value = BigInt(transaction.value || '0');
  const expectedValue = context.tokenIn.kind === 'native' ? context.amountInRaw : 0n;

  if (value !== expectedValue) {
    throw new Error('Uniswap returned an unexpected transaction value.');
  }

  validateRouterCall(transaction.data, context, { spentRaw: 0n });
}

/** Exported for unit tests that need to hit validation without going through the full quote loader. */
export const swapQuoteValidationTestUtils = {
  validateSwapTransaction,
};
