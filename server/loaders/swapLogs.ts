import type {
  HexAddress,
  SwapQuoteRequest,
  SwapRouteStep,
  SwapToken,
  SwapTransactionLogEvent,
  SwapTransactionLogRequest,
} from '../../types/swap.types.ts';

const VALID_SWAP_LOG_EVENTS = new Set<SwapTransactionLogEvent>([
  'approval_submitted',
  'approval_confirmed',
  'approval_failed',
  'swap_submitted',
  'swap_confirmed',
  'swap_failed',
]);

function routeToString(route?: SwapRouteStep[]): string | undefined {
  if (!route?.length) return undefined;
  return route.map((step) => `${step.path.join(' -> ')} (${step.percent}% ${step.protocol})`).join(' | ');
}

function getErrorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  if (error instanceof Error) return error.message;
  return String(error);
}

function writeSwapLog(event: string, payload: Record<string, unknown>): void {
  console.info(JSON.stringify({
    scope: 'swap',
    event,
    loggedAt: new Date().toISOString(),
    ...payload,
  }));
}

export function logSwapQuoteRoute(params: {
  source: 'alpha_router' | 'wbtc_prana_fallback';
  request: SwapQuoteRequest;
  tokenIn: SwapToken;
  tokenOut: SwapToken;
  route: SwapRouteStep[];
  amountInRaw: bigint | string;
  amountOutRaw: bigint | string;
  minimumAmountOutRaw: bigint | string;
  estimatedGasUsed?: bigint | string;
  estimatedGasUsedUsd?: string;
  blockNumber?: bigint | string;
}): void {
  writeSwapLog('quote_route_selected', {
    source: params.source,
    tokenIn: params.tokenIn.symbol,
    tokenOut: params.tokenOut.symbol,
    amountIn: params.request.amountIn,
    amountInRaw: params.amountInRaw.toString(),
    amountOutRaw: params.amountOutRaw.toString(),
    minimumAmountOutRaw: params.minimumAmountOutRaw.toString(),
    slippageBps: params.request.slippageBps,
    recipient: params.request.recipient,
    route: params.route,
    routePath: routeToString(params.route),
    estimatedGasUsed: params.estimatedGasUsed?.toString(),
    estimatedGasUsedUsd: params.estimatedGasUsedUsd,
    blockNumber: params.blockNumber?.toString(),
  });
}

export function logSwapQuoteFailure(params: {
  stage: 'alpha_router' | 'wbtc_prana_fallback' | 'no_route';
  request: SwapQuoteRequest;
  tokenIn?: SwapToken;
  tokenOut?: SwapToken;
  amountInRaw?: bigint | string;
  error?: unknown;
}): void {
  writeSwapLog('quote_route_failed', {
    stage: params.stage,
    tokenIn: params.tokenIn?.symbol ?? params.request.tokenInSymbol,
    tokenOut: params.tokenOut?.symbol ?? params.request.tokenOutSymbol,
    amountIn: params.request.amountIn,
    amountInRaw: params.amountInRaw?.toString(),
    slippageBps: params.request.slippageBps,
    recipient: params.request.recipient,
    error: getErrorMessage(params.error),
  });
}

export function logSwapTransactionEvent(payload: SwapTransactionLogRequest): void {
  writeSwapLog('transaction_event', {
    swapEvent: payload.event,
    ownerAddress: payload.ownerAddress,
    tokenIn: payload.tokenInSymbol,
    tokenOut: payload.tokenOutSymbol,
    amountIn: payload.amountIn,
    amountOut: payload.amountOut,
    amountOutRaw: payload.amountOutRaw,
    minimumAmountOut: payload.minimumAmountOut,
    routerAddress: payload.routerAddress,
    transactionHash: payload.transactionHash,
    receiptStatus: payload.receiptStatus,
    route: payload.route,
    routePath: routeToString(payload.route),
    error: payload.error,
  });
}

export function parseSwapTransactionLogRequest(body: unknown): SwapTransactionLogRequest {
  const payload = body as Partial<SwapTransactionLogRequest>;

  if (!payload || typeof payload !== 'object' || !VALID_SWAP_LOG_EVENTS.has(payload.event as SwapTransactionLogEvent)) {
    throw new Error('Invalid swap log event.');
  }

  return {
    event: payload.event as SwapTransactionLogEvent,
    ownerAddress: payload.ownerAddress as HexAddress | undefined,
    tokenInSymbol: payload.tokenInSymbol,
    tokenOutSymbol: payload.tokenOutSymbol,
    amountIn: payload.amountIn,
    amountOut: payload.amountOut,
    amountOutRaw: payload.amountOutRaw,
    minimumAmountOut: payload.minimumAmountOut,
    route: Array.isArray(payload.route) ? payload.route : undefined,
    routerAddress: payload.routerAddress as HexAddress | undefined,
    transactionHash: payload.transactionHash as HexAddress | undefined,
    error: typeof payload.error === 'string' ? payload.error.slice(0, 1000) : undefined,
    receiptStatus: typeof payload.receiptStatus === 'string' ? payload.receiptStatus : undefined,
  };
}
