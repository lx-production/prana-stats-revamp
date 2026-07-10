import { createRequire } from 'node:module';
import { ethers } from 'ethers';
import { getServerPolygonProvider, getServerPolygonRpcUrl } from '../utils/providers.ts';
import { getSwapToken, getSwapTokenByAddress } from '../../utils/swapTokens.ts';
import {
  POLYGON_CHAIN_ID,
  QUOTER_V2_ABI,
  SWAP_ROUTER_02_ABI,
  UNISWAP_SWAP_ROUTER_02_ADDRESS,
  UNISWAP_V3_QUOTER_V2_ADDRESS,
} from '../../constants/swapContracts.ts';

import type { HexAddress, SwapQuoteRequest, SwapRouteStep, SwapToken } from '../../types/swap.types.ts';

// Uniswap packages are CommonJS in Node ESM — require() loads their working builds (native import breaks @uniswap/sdk-core).
const require = createRequire(import.meta.url);
const { StaticJsonRpcProvider } = require('@ethersproject/providers');
const { AlphaRouter, SwapType } = require('@uniswap/smart-order-router');
const { ChainId, CurrencyAmount, Ether, Percent, Token, TradeType } = require('@uniswap/sdk-core');

export const SWAP_ROUTER_IFACE = new ethers.Interface(SWAP_ROUTER_02_ABI);
const ROUTER_ADDRESS_LOWER = UNISWAP_SWAP_ROUTER_02_ADDRESS.toLowerCase();
const SWAP_ROUTER_MSG_SENDER_RECIPIENT = '0x0000000000000000000000000000000000000001';
const SWAP_ROUTER_ADDRESS_THIS_RECIPIENT = '0x0000000000000000000000000000000000000002';

export type SwapTransactionCandidate = {
  to: HexAddress;
  data: HexAddress;
  value: string;
};

export type SwapValidationContext = {
  request: SwapQuoteRequest;
  tokenIn: SwapToken;
  tokenOut: SwapToken;
  amountInRaw: bigint;
  minimumAmountOutRaw: bigint;
  deadline: number;
  strictPath: boolean;
};

type SwapInputBudget = {
  spentRaw: bigint;
};

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
  return routes.find((item: any) => item?.protocol === 'V3' && item?.route?.pools?.length && item?.tokenPath?.length) ?? null;
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
      // deadline is used — but on the outer multicall(uint256 deadline, bytes[] data) wrapper
      // not inside the exactInput struct.
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

function tokenExecutionAddress(token: SwapToken): string {
  const address = token.address ?? token.wrappedAddress;
  if (!address) throw new Error(`${token.symbol} is missing an execution address.`);
  return address.toLowerCase();
}

function isAllowedRecipient(address: string, request: SwapQuoteRequest): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === request.recipient.toLowerCase() ||
    normalized === ROUTER_ADDRESS_LOWER ||
    normalized === SWAP_ROUTER_MSG_SENDER_RECIPIENT ||
    normalized === SWAP_ROUTER_ADDRESS_THIS_RECIPIENT
  );
}

function decodeV3PathAddresses(path: string): string[] {
  const normalized = path.toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(normalized) || normalized.length < 42) {
    throw new Error('Uniswap returned an invalid V3 path.');
  }

  const addresses = [`0x${normalized.slice(2, 42)}`];
  let offset = 42;

  while (offset < normalized.length) {
    offset += 6; // uint24 pool fee
    if (offset + 40 > normalized.length) {
      throw new Error('Uniswap returned an invalid V3 path.');
    }
    addresses.push(`0x${normalized.slice(offset, offset + 40)}`);
    offset += 40;
  }

  return addresses;
}

function validatePathEndpoints(pathAddresses: string[], context: SwapValidationContext): void {
  if (!context.strictPath) return;

  const first = pathAddresses[0]?.toLowerCase();
  const last = pathAddresses[pathAddresses.length - 1]?.toLowerCase();

  if (first !== tokenExecutionAddress(context.tokenIn) || last !== tokenExecutionAddress(context.tokenOut)) {
    throw new Error('Uniswap returned a route for the wrong token pair.');
  }
}

function spendInputBudget(amountIn: bigint, context: SwapValidationContext, inputBudget: SwapInputBudget): void {
  inputBudget.spentRaw += amountIn;

  if (inputBudget.spentRaw > context.amountInRaw) {
    throw new Error('Uniswap returned calldata with too much cumulative input.');
  }
}

function validateRouterCall(
  data: HexAddress,
  context: SwapValidationContext,
  inputBudget: SwapInputBudget,
  depth = 0,
): void {
  if (depth > 4) throw new Error('Uniswap returned nested calldata that is too deep.');

  const parsed = SWAP_ROUTER_IFACE.parseTransaction({ data });
  if (!parsed) throw new Error('Uniswap returned unsupported router calldata.');

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

    calls.forEach((call) => validateRouterCall(call as HexAddress, context, inputBudget, depth + 1));
    return;
  }

  if (parsed.name === 'exactInput') {
    const params = parsed.args[0];
    const amountIn = BigInt(params.amountIn.toString());
    const amountOutMinimum = BigInt(params.amountOutMinimum.toString());
    const pathAddresses = decodeV3PathAddresses(params.path);

    if (!isAllowedRecipient(params.recipient, context.request)) {
      throw new Error('Uniswap returned calldata for an unexpected recipient.');
    }

    if (context.strictPath) {
      if (amountIn !== context.amountInRaw || amountOutMinimum !== context.minimumAmountOutRaw) {
        throw new Error('Uniswap returned calldata with unexpected amounts.');
      }
      validatePathEndpoints(pathAddresses, context);
    } else if (amountIn > context.amountInRaw) {
      throw new Error('Uniswap returned calldata with too much input.');
    }

    spendInputBudget(amountIn, context, inputBudget);
    return;
  }

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

  if (parsed.name === 'unwrapWETH9' || parsed.name === 'sweepToken') {
    const maybeRecipient = parsed.args.length >= 2 ? parsed.args[parsed.args.length - 1] : undefined;
    if (typeof maybeRecipient === 'string' && !isAllowedRecipient(maybeRecipient, context.request)) {
      throw new Error('Uniswap returned calldata for an unexpected payment recipient.');
    }
    return;
  }

  if (parsed.name === 'wrapETH' || parsed.name === 'refundETH') return;

  throw new Error('Uniswap returned unsupported router calldata.');
}

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

export const swapQuoteValidationTestUtils = {
  validateSwapTransaction,
};

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
