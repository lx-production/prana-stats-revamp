import { createRequire } from 'node:module';
import { ethers } from 'ethers';
import { getServerPolygonProvider, getServerPolygonRpcUrl } from '../utils/providers.ts';
import type { HexAddress, SwapRouteStep, SwapToken } from '../../types/swap.types.ts';
import { getSwapToken, getSwapTokenByAddress, POLYGON_CHAIN_ID, QUOTER_V2_ABI, UNISWAP_V3_QUOTER_V2_ADDRESS } from '../../constants/swapContracts.ts';

// Uniswap packages are CommonJS in Node ESM — require() loads their working builds (native import breaks @uniswap/sdk-core).
const require = createRequire(import.meta.url);
const { StaticJsonRpcProvider } = require('@ethersproject/providers');
const { AlphaRouter, SwapType } = require('@uniswap/smart-order-router');
const { ChainId, CurrencyAmount, Ether, Percent, Token, TradeType } = require('@uniswap/sdk-core');

let routerPromise: Promise<any> | null = null;

// AlphaRouter expects @ethersproject/providers (ethers v5 style)
// AlphaRouter now looks at v3 + v2 pools
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

export function getValidatedSlippageBps(slippageBps: number): number {
  if (!Number.isFinite(slippageBps)) return 50;
  return Math.min(Math.max(Math.round(slippageBps), 1), 500);
}

export function getSlippageTolerance(slippageBps: number): any {
  return new Percent(getValidatedSlippageBps(slippageBps), 10_000);
}

export function getMinimumAmountOut(amountOutRaw: bigint, slippageBps: number): bigint {
  return (amountOutRaw * BigInt(10_000 - getValidatedSlippageBps(slippageBps))) / 10_000n;
}

// Uniswap SDK object for routing/amounts
export function getCurrency(token: SwapToken): any {
  if (token.kind === 'native') {
    return Ether.onChain(ChainId.POLYGON);
  }

  if (!token.address) {
    throw new Error(`${token.symbol} is missing an ERC-20 address.`);
  }

  return new Token(POLYGON_CHAIN_ID, token.address, token.decimals, token.symbol, token.name);
}

export function getExactInputAmount(token: SwapToken, amountInRaw: bigint): any {
  return CurrencyAmount.fromRawAmount(getCurrency(token), amountInRaw.toString());
}

function currencyToDisplaySymbol(currency: any): string {
  if (currency.isNative) return 'POL';

  const knownToken = getSwapTokenByAddress(currency.address);
  return knownToken?.symbol ?? currency.symbol ?? currency.address;
}

// app’s user-facing summary is built from all legs 
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

// takes the raw response from Uniswap’s AlphaRouter (router.route(...)) and pulls out one V3 leg from it 
// or null if there isn’t a usable one.
// one leg can cover multiple hops/pools internally
// the first V3 leg should be the highest-percent V3 leg (from best-swap-route.js)
export function selectV3Route(route: any): any | null {
  // route.route is an array of all the legs in the route, so we need to find the first V3 leg.
  const routes = Array.isArray(route?.route) ? route.route : [];
  return routes.find((item) => item?.protocol === 'V3' && item?.route?.pools?.length && item?.tokenPath?.length) ?? null;
}

// When selectV3Route returns that leg, getV3RoutePathData pulls all tokens and all pool fees
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

// packs them into one V3 path for use in quoteV3Path
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

export async function quoteV3Path(path: HexAddress, amountInRaw: bigint): Promise<{ amountOutRaw: bigint; gasEstimate: bigint }> {
  const provider = await getServerPolygonProvider();
  const quoter = new ethers.Contract(UNISWAP_V3_QUOTER_V2_ADDRESS, QUOTER_V2_ABI, provider);
  const quoted = await quoter.quoteExactInput.staticCall(path, amountInRaw); // read-only simulation over RPC

  return {
    amountOutRaw: BigInt(quoted[0].toString()),
    gasEstimate: BigInt(quoted[3].toString()),
  };
}

export function formatAmountOut(rawAmount: bigint, token: SwapToken): string {
  return ethers.formatUnits(rawAmount, token.decimals);
}

// AlphaRouter uses its own internal NEW_QUOTER_V2_ADDRESSES mapping for V3 quote calls.
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
      type: SwapType.SWAP_ROUTER_02, // flag telling AlphaRouter: “encode the transaction for Swap Router 02.”
      recipient,
      slippageTolerance,
      deadline,
    },
  );
}

// part of the fallback route when Uniswap’s AlphaRouter can’t find a normal tokenIn → tokenOut route.
// Used when you’re buying PRANA
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

// part of the fallback route 
// Used when you’re selling PRANA
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
