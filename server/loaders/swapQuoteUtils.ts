import { createRequire } from 'node:module';
import { ethers } from 'ethers';
import { getSwapToken, getSwapTokenByAddress } from '../../utils/swapTokens.ts';
import { getServerPolygonProvider, getServerPolygonRpcUrl } from '../utils/providers.ts';
import { POLYGON_CHAIN_ID, QUOTER_V2_ABI, SWAP_ROUTER_02_ABI, UNISWAP_SWAP_ROUTER_02_ADDRESS, UNISWAP_V3_QUOTER_V2_ADDRESS } from '../../constants/swapContracts.ts';

import type { HexAddress, SwapQuoteRequest, SwapRouteStep, SwapToken } from '../../types/swap.types.ts';

/**
 * Helpers for building and validating Uniswap swap quotes on Polygon.
 *
 * Flow in plain English:
 * 1. Ask AlphaRouter for the best route (tokenIn → tokenOut).
 * 2. Optionally fall back through WBTC when a direct route is missing.
 * 3. Encode / re-quote V3 paths when we need our own calldata.
 * 4. Validate the final router calldata before returning it to the client
 *    (wrong recipient, wrong amounts, or unexpected methods = reject).
 */

// Uniswap packages are CommonJS in Node ESM — require() loads their working builds
// (native `import` breaks @uniswap/sdk-core in this setup).
const require = createRequire(import.meta.url);
const { StaticJsonRpcProvider } = require('@ethersproject/providers');
const { AlphaRouter, SwapType } = require('@uniswap/smart-order-router');
const { ChainId, CurrencyAmount, Ether, Percent, Token, TradeType } = require('@uniswap/sdk-core');

// Shared ABI decoder for SwapRouter02 calldata (used by validation).
export const SWAP_ROUTER_IFACE = new ethers.Interface(SWAP_ROUTER_02_ABI);
const ROUTER_ADDRESS_LOWER = UNISWAP_SWAP_ROUTER_02_ADDRESS.toLowerCase();

// SwapRouter02 sentinel recipients (not real wallets):
// - msg.sender → pay the EOA that submitted the tx
// - address(this) → keep funds on the router for a later unwrap/sweep in the same multicall
const SWAP_ROUTER_MSG_SENDER_RECIPIENT = '0x0000000000000000000000000000000000000001';
const SWAP_ROUTER_ADDRESS_THIS_RECIPIENT = '0x0000000000000000000000000000000000000002';

/** Minimal tx shape we expect AlphaRouter (or our builder) to produce. */
export type SwapTransactionCandidate = {
  to: HexAddress;
  data: HexAddress;
  value: string;
};

/**
 * Everything validation needs to check calldata against the user's request.
 * `strictPath` = true for a normal single-leg swap (exact amounts + path ends).
 * `strictPath` = false for multi-leg fallbacks (e.g. via WBTC) where each leg
 * only spends part of the total input.
 */
export type SwapValidationContext = {
  request: SwapQuoteRequest;
  tokenIn: SwapToken;
  tokenOut: SwapToken;
  amountInRaw: bigint;
  minimumAmountOutRaw: bigint;
  deadline: number;
  strictPath: boolean; // false for AlphaRouter, true for our fallback path
};

/** Tracks how much input has been spent across nested multicall legs. */
type SwapInputBudget = {
  spentRaw: bigint;
};

// Lazy singleton — building AlphaRouter is expensive (RPC + pool indexing setup).
let routerPromise: Promise<any> | null = null;

/**
 * Returns a cached AlphaRouter for Polygon.
 * AlphaRouter expects @ethersproject/providers (ethers v5 style).
 * It searches V3 + V2 pools; we disable V4 because that needs Universal Router.
 */
export async function getSwapRouter(): Promise<any> {
  if (!routerPromise) {
    routerPromise = getServerPolygonRpcUrl().then((rpcUrl) => {
      const provider = new StaticJsonRpcProvider(rpcUrl, POLYGON_CHAIN_ID);

      return new AlphaRouter({
        chainId: ChainId.POLYGON,
        provider,
        v4Supported: [], // v4 only works with Universal Router, we're not using it
      });
    });
  }

  return routerPromise;
}

/** Clamp slippage to 1–500 bps (0.01%–5%). Invalid numbers fall back to 50 bps (0.5%). */
export function getValidatedSlippageBps(slippageBps: number): number {
  if (!Number.isFinite(slippageBps)) return 50;
  return Math.min(Math.max(Math.round(slippageBps), 1), 500);
}

/** Uniswap SDK Percent for the same slippage (numerator / 10_000). */
export function getSlippageTolerance(slippageBps: number): any {
  return new Percent(getValidatedSlippageBps(slippageBps), 10_000);
}

/**
 * Worst-case output the user will accept:
 * amountOut * (1 - slippage). Example: 1000 out, 50 bps → 995 minimum.
 */
export function getMinimumAmountOut(amountOutRaw: bigint, slippageBps: number): bigint {
  return (amountOutRaw * BigInt(10_000 - getValidatedSlippageBps(slippageBps))) / 10_000n;
}

/** Convert our SwapToken into a Uniswap SDK Currency (native POL or ERC-20 Token). */
export function getCurrency(token: SwapToken): any {
  if (token.kind === 'native') {
    return Ether.onChain(ChainId.POLYGON);
  }

  if (!token.address) {
    throw new Error(`${token.symbol} is missing an ERC-20 address.`);
  }

  return new Token(POLYGON_CHAIN_ID, token.address, token.decimals, token.symbol, token.name);
}

/** Wrap a raw on-chain amount into a CurrencyAmount for AlphaRouter. */
export function getExactInputAmount(token: SwapToken, amountInRaw: bigint): any {
  return CurrencyAmount.fromRawAmount(getCurrency(token), amountInRaw.toString());
}

/** Map a Uniswap currency to a short label for the UI route summary. */
function currencyToDisplaySymbol(currency: any): string {
  if (currency.isNative) return 'POL';

  const knownToken = getSwapTokenByAddress(currency.address);
  return knownToken?.symbol ?? currency.symbol ?? currency.address;
}

/**
 * Build the app’s user-facing route summary from AlphaRouter’s legs.
 * Each step: which protocol, what % of the trade, and the token path labels.
 */
export function buildRouteSummary(route: unknown): SwapRouteStep[] {
  const swapRoute = route as {
    route?: Array<{
      protocol?: string;
      percent?: number;
      tokenPath?: any[];
    }>;
  };

  return (swapRoute.route ?? []).map((step) => ({
    protocol: String(step.protocol ?? 'Uniswap'),
    percent: Number(step.percent ?? 100),
    path: (step.tokenPath ?? []).map(currencyToDisplaySymbol),
  }));
}

/**
 * Pull the first usable V3 leg out of AlphaRouter’s response (or null).
 * One leg can cover multiple hops/pools internally.
 * AlphaRouter’s amount-sorted route list (for exact-input, that’s typically the largest / highest-% V3 split)
 */
export function selectV3Route(route: any): any | null {
  // route.route is an array of all legs — find the first V3 leg with pools + tokenPath.
  const routes = Array.isArray(route?.route) ? route.route : [];
  return routes.find((item: any) => item?.protocol === 'V3' && item?.route?.pools?.length && item?.tokenPath?.length) ?? null;
}

/**
 * From a V3 leg: ordered token addresses, pool fees between them, and display labels.
 * Path shape is always: token0 → fee0 → token1 → fee1 → … → tokenN
 * so addresses.length === fees.length + 1.
 */
export function getV3RoutePathData(v3Route: any): { addresses: HexAddress[]; fees: number[]; pathLabels: string[] } {
  const tokenPath = v3Route.tokenPath as any[];
  const pools = v3Route.route.pools as Array<{ fee: number }>;
  const addresses = tokenPath.map((token) => token.address as HexAddress);
  const fees = pools.map((pool) => Number(pool.fee));
  const pathLabels = tokenPath.map(currencyToDisplaySymbol);

  if (addresses.length !== fees.length + 1) {
    throw new Error('Uniswap returned an invalid V3 route path.');
  }

  return { addresses, fees, pathLabels };
}

/**
 * Pack addresses + fees into the packed bytes path Uniswap V3 expects:
 * abi.encodePacked(address, uint24, address, uint24, …, address)
 */
export function encodeV3Path(addresses: HexAddress[], fees: number[]): HexAddress {
  const types: string[] = [];
  const values: Array<string | number> = [];

  addresses.forEach((address, index) => {
    types.push('address');
    values.push(address);

    if (index < fees.length) {
      types.push('uint24');
      values.push(fees[index]);
    }
  });

  return ethers.solidityPacked(types, values) as HexAddress;
}

/**
 * Ask QuoterV2 (on-chain, read-only) how much `tokenOut` you’d get for this path + amountIn.
 * Used to double-check / refresh amounts independently of AlphaRouter’s quote.
 */
export async function quoteV3Path(path: HexAddress, amountInRaw: bigint): Promise<{ amountOutRaw: bigint; gasEstimate: bigint }> {
  const provider = await getServerPolygonProvider();
  const quoter = new ethers.Contract(UNISWAP_V3_QUOTER_V2_ADDRESS, QUOTER_V2_ABI, provider);
  // staticCall = simulate without sending a real tx
  const quoted = await quoter.quoteExactInput.staticCall(path, amountInRaw);

  return {
    amountOutRaw: BigInt(quoted[0].toString()),
    gasEstimate: BigInt(quoted[3].toString()),
  };
}

/** Human-readable amountOut string using the token’s decimals. */
export function formatAmountOut(rawAmount: bigint, token: SwapToken): string {
  return ethers.formatUnits(rawAmount, token.decimals);
}

/**
 * Primary quote: ask AlphaRouter for tokenIn → tokenOut and encode SwapRouter02 calldata.
 * Note: AlphaRouter uses its own NEW_QUOTER_V2_ADDRESSES for internal V3 quotes.
 * `deadline` lands on the outer multicall(uint256 deadline, bytes[] data) wrapper,
 * not inside the exactInput struct itself.
 */
export async function loadPrimaryRoute(
  router: any,
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  amountInRaw: bigint,
  recipient: HexAddress,
  slippageTolerance: any,
  deadline: number,
): Promise<any> {
  return router.route(
    getExactInputAmount(tokenIn, amountInRaw),
    getCurrency(tokenOut),
    TradeType.EXACT_INPUT,
    {
      type: SwapType.SWAP_ROUTER_02, // encode tx for Swap Router 02 (not Universal Router)
      recipient,
      slippageTolerance,
      deadline,
    },
  );
}

/**
 * Fallback leg when buying PRANA: route tokenIn → WBTC first.
 * Returns only the V3 leg (or null) so the caller can chain a second hop.
 */
export async function loadRouteToWbtc(router: any, token: SwapToken, amountInRaw: bigint, recipient: HexAddress, slippageTolerance: any, deadline: number): Promise<any | null> {
  const wbtc = getSwapToken('WBTC');
  const route = await router.route(
    CurrencyAmount.fromRawAmount(getCurrency(token), amountInRaw.toString()),
    getCurrency(wbtc),
    TradeType.EXACT_INPUT,
    {
      type: SwapType.SWAP_ROUTER_02,
      recipient,
      slippageTolerance,
      deadline,
    },
  );

  return selectV3Route(route);
}

/**
 * Fallback leg when selling PRANA: route WBTC → tokenOut.
 * Paired with loadRouteToWbtc to bridge thin PRANA liquidity via WBTC.
 */
export async function loadRouteFromWbtc(router: any, token: SwapToken, wbtcAmountRaw: bigint, recipient: HexAddress, slippageTolerance: any, deadline: number): Promise<any | null> {
  const wbtc = getSwapToken('WBTC');
  const route = await router.route(
    CurrencyAmount.fromRawAmount(getCurrency(wbtc), wbtcAmountRaw.toString()),
    getCurrency(token),
    TradeType.EXACT_INPUT,
    {
      type: SwapType.SWAP_ROUTER_02,
      recipient,
      slippageTolerance,
      deadline,
    },
  );

  return selectV3Route(route);
}

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

/** Small metadata blob for logging / analytics around a quote request. */
export function buildQuoteRequestMetadata(request: SwapQuoteRequest, amountInRaw: bigint) {
  return {
    tokenInSymbol: request.tokenInSymbol,
    tokenOutSymbol: request.tokenOutSymbol,
    amountIn: request.amountIn,
    recipient: request.recipient,
    slippageBps: getValidatedSlippageBps(request.slippageBps),
    amountInRaw: amountInRaw.toString(),
    chainId: POLYGON_CHAIN_ID,
  };
}
