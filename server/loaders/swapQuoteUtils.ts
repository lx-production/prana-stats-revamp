import { createRequire } from 'node:module';
import { ethers } from 'ethers';
import { getServerPolygonRpcUrl } from '../utils/providers.ts';
import type { HexAddress, SwapRouteStep, SwapToken } from '../../types/swap.types.ts';
import { getSwapTokenByAddress, POLYGON_CHAIN_ID } from '../../constants/swapContracts.ts';

// Uniswap packages are CommonJS in Node ESM — require() loads their working builds (native import breaks @uniswap/sdk-core).
const require = createRequire(import.meta.url);
const { StaticJsonRpcProvider } = require('@ethersproject/providers');
const { ChainId, Ether, Token } = require('@uniswap/sdk-core');
const { AlphaRouter } = require('@uniswap/smart-order-router');

let routerPromise: Promise<any> | null = null;

export function getValidatedSlippageBps(slippageBps: number): number {
  if (!Number.isFinite(slippageBps)) return 50;
  return Math.min(Math.max(Math.round(slippageBps), 1), 500);
}

export function getCurrency(token: SwapToken): any {
  if (token.kind === 'native') {
    return Ether.onChain(ChainId.POLYGON);
  }

  if (!token.address) {
    throw new Error(`${token.symbol} is missing an ERC-20 address.`);
  }

  return new Token(POLYGON_CHAIN_ID, token.address, token.decimals, token.symbol, token.name);
}

export async function getSwapRouter(): Promise<any> {
  if (!routerPromise) {
    routerPromise = getServerPolygonRpcUrl().then((rpcUrl) => {
      const provider = new StaticJsonRpcProvider(rpcUrl, POLYGON_CHAIN_ID);

      return new AlphaRouter({
        chainId: ChainId.POLYGON,
        provider,
        v4Supported: [],
      });
    });
  }

  return routerPromise;
}

function currencyToDisplaySymbol(currency: any): string {
  if (currency.isNative) return 'POL';

  const knownToken = getSwapTokenByAddress(currency.address);
  return knownToken?.symbol ?? currency.symbol ?? currency.address;
}

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

export function getSwapAddress(token: SwapToken): HexAddress {
  const address = token.kind === 'native' ? token.wrappedAddress : token.address;

  if (!address) {
    throw new Error(`${token.symbol} is missing a swap address.`);
  }

  return address;
}

export function selectV3Route(route: any): any | null {
  const routes = Array.isArray(route?.route) ? route.route : [];
  return routes.find((item) => item?.protocol === 'V3' && item?.route?.pools?.length && item?.tokenPath?.length) ?? null;
}

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

export function getMinimumAmountOut(amountOutRaw: bigint, slippageBps: number): bigint {
  return (amountOutRaw * BigInt(10_000 - getValidatedSlippageBps(slippageBps))) / 10_000n;
}

export function formatAmountOut(rawAmount: bigint, token: SwapToken): string {
  return ethers.formatUnits(rawAmount, token.decimals);
}
