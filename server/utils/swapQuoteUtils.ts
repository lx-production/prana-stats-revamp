import { createRequire } from 'node:module';
import { ethers } from 'ethers';
import { getSwapToken, getSwapTokenByAddress } from '../../utils/swapTokens.ts';
import { getServerPolygonProvider, getServerPolygonRpcUrl } from './providers.ts';
import { POLYGON_CHAIN_ID } from '../../constants/network.ts';
import { QUOTER_V2_ABI, UNISWAP_V3_QUOTER_V2_ADDRESS } from '../../constants/swapContracts.ts';

import type { HexAddress, SwapQuoteRequest, SwapRouteStep, SwapToken } from '../../types/swap.types.ts';

/**
 * Helpers for building Uniswap swap quotes on Polygon.
 *
 * Flow in plain English:
 * 1. Ask AlphaRouter for the best route (tokenIn → tokenOut).
 * 2. Optionally fall back through WBTC when a direct route is missing.
 * 3. Encode / re-quote V3 paths when we need our own calldata.
 * 4. Callers validate the final router calldata via `swapValidations.ts`
 *    before returning it to the client.
 */

// Uniswap packages are CommonJS in Node ESM — require() loads their working builds
// (native `import` breaks @uniswap/sdk-core in this setup).
const require = createRequire(import.meta.url);
const { StaticJsonRpcProvider } = require('@ethersproject/providers');
const { AlphaRouter, SwapType } = require('@uniswap/smart-order-router');
const { ChainId, CurrencyAmount, Ether, Percent, Token, TradeType } = require('@uniswap/sdk-core');

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
