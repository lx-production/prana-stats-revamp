import { ethers } from 'ethers';
import { getSwapToken } from '../../utils/swapTokens.ts';
import { attachSwapQuoteVerification } from './swapQuoteVerification.ts';
import { PRANA_ADDRESS, WBTC_ADDRESS } from '../../constants/sharedContracts.ts';
import { SWAP_ROUTER_IFACE, validateSwapTransaction } from './swapValidations.ts';
import { logSwapQuoteFailure, logSwapQuoteRoute, type SwapRequestLogMetadata } from './swapLogs.ts';
import { SWAP_DEADLINE_SECONDS, UNISWAP_SWAP_ROUTER_02_ADDRESS } from '../../constants/swapContracts.ts';
import { buildQuoteRequestMetadata, buildRouteSummary, encodeV3Path, formatAmountOut, getMinimumAmountOut, getSlippageTolerance, getSwapRouter, getV3RoutePathData, loadPrimaryRoute, loadRouteFromWbtc, loadRouteToWbtc, quoteV3Path } from '../utils/swapQuoteUtils.ts';

import type { HexAddress, SwapQuoteRequest, SwapQuoteResponse, SwapToken } from '../../types/swap.types.ts';

const V3_PRANA_POOL_FEE = 10_000; // 1% fee

export async function loadSwapQuote(
  request: SwapQuoteRequest,
  logMetadata?: SwapRequestLogMetadata,
): Promise<SwapQuoteResponse> {
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

  const slippageTolerance = getSlippageTolerance(request.slippageBps);
  const deadline = Math.floor(Date.now() / 1000) + SWAP_DEADLINE_SECONDS;
  const router = await getSwapRouter();
  let route: any | null = null;

  try {
    route = await loadPrimaryRoute(router, tokenIn, tokenOut, amountInRaw, request.recipient, slippageTolerance, deadline);
  } catch (err) {
    logSwapQuoteFailure({
      stage: 'alpha_router',
      request,
      tokenIn,
      tokenOut,
      amountInRaw,
      error: err,
    }, logMetadata);
    route = null;
  }

  if (!route || !route.methodParameters) {
    let fallbackQuote: SwapQuoteResponse | null = null;

    try {
      fallbackQuote = await loadWbtcPranaFallbackQuote(
        request,
        tokenIn,
        tokenOut,
        amountInRaw,
        slippageTolerance,
        deadline,
        router, // AlphaRouter
        logMetadata,
      );
    } catch (err) {
      logSwapQuoteFailure({
        stage: 'wbtc_prana_fallback',
        request,
        tokenIn,
        tokenOut,
        amountInRaw,
        error: err,
      }, logMetadata);
      throw err;
    }

    if (fallbackQuote) return fallbackQuote;

    logSwapQuoteFailure({
      stage: 'no_route',
      request,
      tokenIn,
      tokenOut,
      amountInRaw,
    }, logMetadata);
    throw new Error('No Uniswap route found for this pair or amount.');
  }

  const amountOutRaw = route.quote.quotient.toString();
  const minimumAmountOutRaw = route.trade.minimumAmountOut(slippageTolerance).quotient.toString();
  const routeSummary = buildRouteSummary(route);
  const transaction = {
    to: route.methodParameters.to as HexAddress,
    data: route.methodParameters.calldata as HexAddress,
    value: route.methodParameters.value,
  };

  try {
    validateSwapTransaction(transaction, {
      request,
      tokenIn,
      tokenOut,
      amountInRaw,
      minimumAmountOutRaw: BigInt(minimumAmountOutRaw),
      deadline,
      strictPath: false,
    });
  } catch (err) {
    logSwapQuoteFailure({
      stage: 'alpha_router_validation',
      request,
      tokenIn,
      tokenOut,
      amountInRaw,
      error: err,
    }, logMetadata);
    throw err;
  }

  logSwapQuoteRoute({
    source: 'alpha_router',
    request,
    tokenIn,
    tokenOut,
    route: routeSummary,
    amountInRaw,
    amountOutRaw,
    minimumAmountOutRaw,
    estimatedGasUsed: route.estimatedGasUsed?.toString(),
    estimatedGasUsedUsd: route.estimatedGasUsedUSD?.toExact(),
    blockNumber: route.blockNumber?.toString(),
  }, logMetadata);

  return attachSwapQuoteVerification({
    request: buildQuoteRequestMetadata(request, amountInRaw),
    tokenIn,
    tokenOut,
    amountIn: request.amountIn,
    amountOut: route.quote.toExact(),
    amountOutRaw,
    minimumAmountOut: minimumAmountOutRaw,
    route: routeSummary,
    estimatedGasUsed: route.estimatedGasUsed?.toString(),
    estimatedGasUsedUsd: route.estimatedGasUsedUSD?.toExact(),
    gasPriceWei: route.gasPriceWei?.toString(),
    routerAddress: UNISWAP_SWAP_ROUTER_02_ADDRESS,
    transaction,
    blockNumber: route.blockNumber?.toString(),
    deadline,
    quoteUpdatedAt: new Date().toISOString(),
  });
}

// v3 pool only fallback quote
// The fallback doesn't ask for a full tokenIn → tokenOut route. It asks for one leg at a time.
async function loadWbtcPranaFallbackQuote(
  request: SwapQuoteRequest,
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  amountInRaw: bigint,
  slippageTolerance: any,
  deadline: number,
  router: any,
  logMetadata?: SwapRequestLogMetadata,
): Promise<SwapQuoteResponse | null> {
  // only runs for swaps involving PRANA where the other token is not WBTC (WBTC↔PRANA is handled directly by the primary router)
  // for swaps between the remaining supported non-PRANA tokens, the app only uses the primary route
  const routesToPrana = tokenOut.symbol === 'PRANA' && tokenIn.symbol !== 'WBTC';
  const routesFromPrana = tokenIn.symbol === 'PRANA' && tokenOut.symbol !== 'WBTC';

  if (!routesToPrana && !routesFromPrana) return null;

  let addresses: HexAddress[];
  let fees: number[];
  let pathLabels: string[];
  
  // buying PRANA (e.g. USDT → PRANA)
  if (routesToPrana) {
    const v3Route = await loadRouteToWbtc(router, tokenIn, amountInRaw, request.recipient, slippageTolerance, deadline);
    
    if (!v3Route) {
      logSwapQuoteFailure({
        stage: 'wbtc_prana_fallback',
        request,
        tokenIn,
        tokenOut,
        amountInRaw,
      }, logMetadata);
      return null;
    }
    
    // pulls token addresses, pool fees, and labels from that leg
    const routePath = getV3RoutePathData(v3Route);

    addresses = [...routePath.addresses, PRANA_ADDRESS as HexAddress];
    fees = [...routePath.fees, V3_PRANA_POOL_FEE];
    pathLabels = [...routePath.pathLabels, 'PRANA'];
  } else {
    // selling PRANA (e.g. PRANA → USDT)
    const pranaToWbtcPath = encodeV3Path(
      [PRANA_ADDRESS as HexAddress, WBTC_ADDRESS as HexAddress],
      [V3_PRANA_POOL_FEE],
    );
    
    const pranaToWbtcQuote = await quoteV3Path(pranaToWbtcPath, amountInRaw);
    const v3Route = await loadRouteFromWbtc(router, tokenOut, pranaToWbtcQuote.amountOutRaw, request.recipient, slippageTolerance, deadline);
    
    if (!v3Route) {
      logSwapQuoteFailure({
        stage: 'wbtc_prana_fallback',
        request,
        tokenIn,
        tokenOut,
        amountInRaw,
      }, logMetadata);
      return null;
    }

    const routePath = getV3RoutePathData(v3Route);
    addresses = [PRANA_ADDRESS as HexAddress, ...routePath.addresses];
    fees = [V3_PRANA_POOL_FEE, ...routePath.fees];
    pathLabels = ['PRANA', ...routePath.pathLabels];
  }

  const path = encodeV3Path(addresses, fees);
  const quote = await quoteV3Path(path, amountInRaw);
  const minimumAmountOutRaw = getMinimumAmountOut(quote.amountOutRaw, request.slippageBps);
  const exactInputRecipient = tokenOut.kind === 'native' ? UNISWAP_SWAP_ROUTER_02_ADDRESS : request.recipient;
  const routeSummary = [{
    protocol: 'V3',
    percent: 100,
    path: pathLabels,
  }];

  logSwapQuoteRoute({
    source: 'wbtc_prana_fallback',
    request,
    tokenIn,
    tokenOut,
    route: routeSummary,
    amountInRaw,
    amountOutRaw: quote.amountOutRaw,
    minimumAmountOutRaw,
    estimatedGasUsed: quote.gasEstimate,
  }, logMetadata);

  const exactInputCalldata = SWAP_ROUTER_IFACE.encodeFunctionData('exactInput', [{
    path,
    recipient: exactInputRecipient,
    amountIn: amountInRaw,
    amountOutMinimum: minimumAmountOutRaw,
  }]); // SwapRouter02’s exactInput takes a 4-field struct, no deadline field (only the old router uses a 5-field struct)
  
  const calls = tokenOut.kind === 'native'
    ? [
        exactInputCalldata,
        SWAP_ROUTER_IFACE.encodeFunctionData('unwrapWETH9(uint256,address)', [minimumAmountOutRaw, request.recipient]),
      ]
    : [exactInputCalldata];

  const calldata = SWAP_ROUTER_IFACE.encodeFunctionData('multicall(uint256,bytes[])', [deadline, calls]);
  
  const transaction = {
    to: UNISWAP_SWAP_ROUTER_02_ADDRESS,
    data: calldata as HexAddress,
    value: tokenIn.kind === 'native' ? amountInRaw.toString() : '0',
  };

  validateSwapTransaction(transaction, {
    request,
    tokenIn,
    tokenOut,
    amountInRaw,
    minimumAmountOutRaw,
    deadline,
    strictPath: true,
  });

  return attachSwapQuoteVerification({
    request: buildQuoteRequestMetadata(request, amountInRaw),
    tokenIn,
    tokenOut,
    amountIn: request.amountIn,
    amountOut: formatAmountOut(quote.amountOutRaw, tokenOut),
    amountOutRaw: quote.amountOutRaw.toString(),
    minimumAmountOut: minimumAmountOutRaw.toString(),
    route: routeSummary,
    estimatedGasUsed: quote.gasEstimate.toString(),
    routerAddress: UNISWAP_SWAP_ROUTER_02_ADDRESS,
    transaction,
    deadline,
    quoteUpdatedAt: new Date().toISOString(),
  });
}
