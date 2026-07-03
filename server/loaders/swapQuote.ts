import { ethers } from 'ethers';
import type { HexAddress, SwapQuoteRequest, SwapQuoteResponse, SwapToken } from '../../types/swap.types.ts';
import { PRANA_ADDRESS, WBTC_ADDRESS } from '../../constants/sharedContracts.ts';
import { POLYGON_CHAIN_ID, SWAP_DEADLINE_SECONDS, SWAP_ROUTER_02_ABI, UNISWAP_SWAP_ROUTER_02_ADDRESS } from '../../constants/swapContracts.ts';
import { getSwapToken } from '../../utils/swapTokens.ts';
import { logSwapQuoteFailure, logSwapQuoteRoute } from './swapLogs.ts';
import { buildRouteSummary, encodeV3Path, formatAmountOut, getMinimumAmountOut, getSwapRouter, getSlippageTolerance, getValidatedSlippageBps, getV3RoutePathData, loadPrimaryRoute, loadRouteFromWbtc, loadRouteToWbtc, quoteV3Path } from './swapQuoteUtils.ts';

const V3_PRANA_POOL_FEE = 10_000; // 1% fee

const SWAP_ROUTER_IFACE = new ethers.Interface(SWAP_ROUTER_02_ABI);
const ROUTER_ADDRESS_LOWER = UNISWAP_SWAP_ROUTER_02_ADDRESS.toLowerCase();

type SwapTransactionCandidate = {
  to: HexAddress;
  data: HexAddress;
  value: string;
};

type SwapValidationContext = {
  request: SwapQuoteRequest;
  tokenIn: SwapToken;
  tokenOut: SwapToken;
  amountInRaw: bigint;
  minimumAmountOutRaw: bigint;
  deadline: number;
  strictPath: boolean;
};

function tokenExecutionAddress(token: SwapToken): string {
  const address = token.address ?? token.wrappedAddress;
  if (!address) throw new Error(`${token.symbol} is missing an execution address.`);
  return address.toLowerCase();
}

function isAllowedRecipient(address: string, request: SwapQuoteRequest): boolean {
  const normalized = address.toLowerCase();
  return normalized === request.recipient.toLowerCase() || normalized === ROUTER_ADDRESS_LOWER;
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

function validateRouterCall(data: HexAddress, context: SwapValidationContext, depth = 0): void {
  if (depth > 4) throw new Error('Uniswap returned nested calldata that is too deep.');

  const parsed = SWAP_ROUTER_IFACE.parseTransaction({ data });
  if (!parsed) throw new Error('Uniswap returned unsupported router calldata.');

  if (parsed.name === 'multicall') {
    const calls = Array.from(parsed.args.length === 2 ? parsed.args[1] : parsed.args[0]);

    if (parsed.args.length === 2) {
      const txDeadline = BigInt(parsed.args[0].toString());
      if (txDeadline !== BigInt(context.deadline)) {
        throw new Error('Uniswap returned calldata with an unexpected deadline.');
      }
    }

    if (!calls.length) {
      throw new Error('Uniswap returned an empty multicall.');
    }

    calls.forEach((call) => validateRouterCall(call as HexAddress, context, depth + 1));
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

function validateSwapTransaction(transaction: SwapTransactionCandidate, context: SwapValidationContext): void {
  if (transaction.to.toLowerCase() !== ROUTER_ADDRESS_LOWER) {
    throw new Error('Uniswap returned an unexpected router address.');
  }

  const value = BigInt(transaction.value || '0');
  const expectedValue = context.tokenIn.kind === 'native' ? context.amountInRaw : 0n;

  if (value !== expectedValue) {
    throw new Error('Uniswap returned an unexpected transaction value.');
  }

  validateRouterCall(transaction.data, context);
}

function buildQuoteRequestMetadata(request: SwapQuoteRequest, amountInRaw: bigint) {
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
    });
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
      );
    } catch (err) {
      logSwapQuoteFailure({
        stage: 'wbtc_prana_fallback',
        request,
        tokenIn,
        tokenOut,
        amountInRaw,
        error: err,
      });
      throw err;
    }

    if (fallbackQuote) return fallbackQuote;

    logSwapQuoteFailure({
      stage: 'no_route',
      request,
      tokenIn,
      tokenOut,
      amountInRaw,
    });
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

  validateSwapTransaction(transaction, {
    request,
    tokenIn,
    tokenOut,
    amountInRaw,
    minimumAmountOutRaw: BigInt(minimumAmountOutRaw),
    deadline,
    strictPath: false,
  });

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
  });

  return {
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
  };
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
      });
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
      });
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
  });

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

  return {
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
  };
}
