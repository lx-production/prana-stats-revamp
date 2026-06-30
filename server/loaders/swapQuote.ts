import { createRequire } from 'node:module';
import { ethers } from 'ethers';
import { getServerPolygonProvider } from '../utils/providers.ts';
import type { HexAddress, SwapQuoteRequest, SwapQuoteResponse, SwapToken } from '../../types/swap.types.ts';
import { getSwapToken, QUOTER_V2_ABI, SWAP_DEADLINE_SECONDS, SWAP_ROUTER_02_ABI, UNISWAP_SWAP_ROUTER_02_ADDRESS, UNISWAP_V3_QUOTER_V2_ADDRESS, WBTC_PRANA_POOL_ADDRESS } from '../../constants/swapContracts.ts';
import { buildRouteSummary, encodeV3Path, formatAmountOut, getCurrency, getMinimumAmountOut, getSwapAddress, getSwapRouter, getV3RoutePathData, getValidatedSlippageBps, selectV3Route } from './swapQuoteUtils.ts';

// Uniswap packages are CommonJS in Node ESM — require() loads their working builds (native import breaks @uniswap/sdk-core).
// AlphaRouter requires an ethers v5 provider; the rest of this file uses ethers v6 via getServerPolygonProvider().
const require = createRequire(import.meta.url);
const { CurrencyAmount, Percent, TradeType } = require('@uniswap/sdk-core');
const { SwapType } = require('@uniswap/smart-order-router');

const V3_PRANA_POOL_FEE = 10_000; // 1% fee

const SWAP_ROUTER_IFACE = new ethers.Interface(SWAP_ROUTER_02_ABI);

async function loadRouteToWbtc(router: any, token: SwapToken, amountInRaw: bigint, recipient: HexAddress, slippageTolerance: any, deadline: number): Promise<any | null> {
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

async function loadRouteFromWbtc(router: any, token: SwapToken, wbtcAmountRaw: bigint, recipient: HexAddress, slippageTolerance: any, deadline: number): Promise<any | null> {
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

async function quoteV3Path(path: HexAddress, amountInRaw: bigint): Promise<{ amountOutRaw: bigint; gasEstimate: bigint }> {
  const provider = await getServerPolygonProvider();
  const quoter = new ethers.Contract(UNISWAP_V3_QUOTER_V2_ADDRESS, QUOTER_V2_ABI, provider);
  const quoted = await quoter.quoteExactInput.staticCall(path, amountInRaw);

  return {
    amountOutRaw: BigInt(quoted[0].toString()),
    gasEstimate: BigInt(quoted[3].toString()),
  };
}

async function loadWbtcPranaFallbackQuote(
  request: SwapQuoteRequest,
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  amountInRaw: bigint,
  slippageTolerance: any,
  deadline: number,
  router: any,
): Promise<SwapQuoteResponse | null> {
  const wbtc = getSwapToken('WBTC');
  const prana = getSwapToken('PRANA');
  const routesToPrana = tokenOut.symbol === 'PRANA' && tokenIn.symbol !== 'WBTC';
  const routesFromPrana = tokenIn.symbol === 'PRANA' && tokenOut.symbol !== 'WBTC';

  if (!routesToPrana && !routesFromPrana) return null;

  let addresses: HexAddress[];
  let fees: number[];
  let pathLabels: string[];

  if (routesToPrana) {
    const v3Route = await loadRouteToWbtc(router, tokenIn, amountInRaw, request.recipient, slippageTolerance, deadline);
    if (!v3Route) return null;

    const routePath = getV3RoutePathData(v3Route);
    addresses = [...routePath.addresses, getSwapAddress(prana)];
    fees = [...routePath.fees, V3_PRANA_POOL_FEE];
    pathLabels = [...routePath.pathLabels, 'PRANA'];
  } else {
    const pranaToWbtcPath = encodeV3Path(
      [getSwapAddress(prana), getSwapAddress(wbtc)],
      [V3_PRANA_POOL_FEE],
    );
    const pranaToWbtcQuote = await quoteV3Path(pranaToWbtcPath, amountInRaw);
    const v3Route = await loadRouteFromWbtc(router, tokenOut, pranaToWbtcQuote.amountOutRaw, request.recipient, slippageTolerance, deadline);
    if (!v3Route) return null;

    const routePath = getV3RoutePathData(v3Route);
    addresses = [getSwapAddress(prana), ...routePath.addresses];
    fees = [V3_PRANA_POOL_FEE, ...routePath.fees];
    pathLabels = ['PRANA', ...routePath.pathLabels];
  }

  const path = encodeV3Path(addresses, fees);
  const quote = await quoteV3Path(path, amountInRaw);
  const minimumAmountOutRaw = getMinimumAmountOut(quote.amountOutRaw, request.slippageBps);
  const exactInputRecipient = tokenOut.kind === 'native' ? UNISWAP_SWAP_ROUTER_02_ADDRESS : request.recipient;
  const exactInputCalldata = SWAP_ROUTER_IFACE.encodeFunctionData('exactInput', [{
    path,
    recipient: exactInputRecipient,
    amountIn: amountInRaw,
    amountOutMinimum: minimumAmountOutRaw,
  }]);
  const calldata = tokenOut.kind === 'native'
    ? SWAP_ROUTER_IFACE.encodeFunctionData('multicall', [[
        exactInputCalldata,
        SWAP_ROUTER_IFACE.encodeFunctionData('unwrapWETH9', [minimumAmountOutRaw, request.recipient]),
      ]])
    : exactInputCalldata;

  return {
    tokenIn,
    tokenOut,
    amountIn: request.amountIn,
    amountOut: formatAmountOut(quote.amountOutRaw, tokenOut),
    amountOutRaw: quote.amountOutRaw.toString(),
    minimumAmountOut: minimumAmountOutRaw.toString(),
    route: [{
      protocol: 'V3',
      percent: 100,
      path: pathLabels,
    }],
    estimatedGasUsed: quote.gasEstimate.toString(),
    routerAddress: UNISWAP_SWAP_ROUTER_02_ADDRESS,
    transaction: {
      to: UNISWAP_SWAP_ROUTER_02_ADDRESS,
      data: calldata as HexAddress,
      value: tokenIn.kind === 'native' ? amountInRaw.toString() : '0',
    },
    quoteUpdatedAt: new Date().toISOString(),
  };
}

export async function loadSwapQuote(request: SwapQuoteRequest): Promise<SwapQuoteResponse> {
  const tokenIn = getSwapToken(request.tokenInSymbol);
  const tokenOut = getSwapToken(request.tokenOutSymbol);

  if (tokenIn.symbol === tokenOut.symbol) {
    throw new Error('Choose two different tokens.');
  }

  if (!ethers.isAddress(request.recipient)) {
    throw new Error('Connect a valid wallet address.');
  }

  const amountInRaw = ethers.parseUnits(request.amountIn, tokenIn.decimals);

  if (amountInRaw <= 0n) {
    throw new Error('Enter an amount greater than zero.');
  }

  const currencyIn = getCurrency(tokenIn);
  const currencyOut = getCurrency(tokenOut);
  const amount = CurrencyAmount.fromRawAmount(currencyIn, amountInRaw.toString());
  const slippageTolerance = new Percent(getValidatedSlippageBps(request.slippageBps), 10_000);
  const deadline = Math.floor(Date.now() / 1000) + SWAP_DEADLINE_SECONDS;
  const router = await getSwapRouter();
  let route: any | null = null;

  try {
    route = await router.route(
      amount,
      currencyOut,
      TradeType.EXACT_INPUT,
      {
        type: SwapType.SWAP_ROUTER_02,
        recipient: request.recipient,
        slippageTolerance,
        deadline,
      },
      {
        poolsToManuallyRouteThrough: [WBTC_PRANA_POOL_ADDRESS],
      },
    );
  } catch {
    route = null;
  }

  if (!route || !route.methodParameters) {
    const fallbackQuote = await loadWbtcPranaFallbackQuote(
      request,
      tokenIn,
      tokenOut,
      amountInRaw,
      slippageTolerance,
      deadline,
      router,
    );

    if (fallbackQuote) return fallbackQuote;

    throw new Error('No Uniswap route found for this pair or amount.');
  }

  const amountOutRaw = route.quote.quotient.toString();
  const minimumAmountOutRaw = route.trade.minimumAmountOut(slippageTolerance).quotient.toString();

  return {
    tokenIn,
    tokenOut,
    amountIn: request.amountIn,
    amountOut: route.quote.toExact(),
    amountOutRaw,
    minimumAmountOut: minimumAmountOutRaw,
    route: buildRouteSummary(route),
    estimatedGasUsed: route.estimatedGasUsed?.toString(),
    estimatedGasUsedUsd: route.estimatedGasUsedUSD?.toExact(),
    gasPriceWei: route.gasPriceWei?.toString(),
    routerAddress: UNISWAP_SWAP_ROUTER_02_ADDRESS,
    transaction: {
      to: route.methodParameters.to as HexAddress,
      data: route.methodParameters.calldata as HexAddress,
      value: route.methodParameters.value,
    },
    blockNumber: route.blockNumber?.toString(),
    quoteUpdatedAt: new Date().toISOString(),
  };
}
