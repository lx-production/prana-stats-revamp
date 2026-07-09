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
  'swap_failed',
]);

export type SwapRequestLogMetadata = {
  clientIp?: string;
  requestHost?: string;
  requestOrigin?: string;
  userAgent?: string;
};

function sanitizeLogString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value
    .replace(/https?:\/\/[^\s"']+/gi, '[redacted-url]')
    .replace(/(alchemyapi\.io\/v2\/|alchemy\.com\/v2\/)[A-Za-z0-9_-]+/gi, '$1[redacted]')
    .slice(0, maxLength);
}

function normalizeLoggedClientIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  if (ip === '127.0.0.1' || ip === '::1') return 'localhost';
  return sanitizeLogString(ip, 120);
}

function sanitizeLogOrigin(origin: string | undefined): string | undefined {
  if (!origin) return undefined;

  try {
    return new URL(origin).origin.slice(0, 255);
  } catch {
    return sanitizeLogString(origin, 255);
  }
}

function sanitizeRequestLogMetadata(metadata?: SwapRequestLogMetadata): SwapRequestLogMetadata {
  return {
    clientIp: normalizeLoggedClientIp(metadata?.clientIp),
    requestHost: sanitizeLogString(metadata?.requestHost, 255),
    requestOrigin: sanitizeLogOrigin(metadata?.requestOrigin),
    userAgent: sanitizeLogString(metadata?.userAgent, 500),
  };
}

function routeToString(route?: SwapRouteStep[]): string | undefined {
  if (!route?.length) return undefined;
  return route.map((step) => `${step.path.join(' -> ')} (${step.percent}% ${step.protocol})`).join(' | ');
}

function getErrorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  return sanitizeLogString(error instanceof Error ? error.message : String(error), 1000);
}

function writeSwapLog(
  event: string,
  payload: Record<string, unknown>,
  metadata?: SwapRequestLogMetadata,
): void {
  console.info(JSON.stringify({
    scope: 'swap',
    event,
    loggedAt: new Date().toISOString(),
    ...payload,
    ...sanitizeRequestLogMetadata(metadata),
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
}, metadata?: SwapRequestLogMetadata): void {
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
  }, metadata);
}

export function logSwapQuoteFailure(params: {
  stage: 'alpha_router' | 'alpha_router_validation' | 'wbtc_prana_fallback' | 'no_route';
  request: SwapQuoteRequest;
  tokenIn?: SwapToken;
  tokenOut?: SwapToken;
  amountInRaw?: bigint | string;
  error?: unknown;
}, metadata?: SwapRequestLogMetadata): void {
  writeSwapLog('quote_route_failed', {
    stage: params.stage,
    tokenIn: params.tokenIn?.symbol ?? params.request.tokenInSymbol,
    tokenOut: params.tokenOut?.symbol ?? params.request.tokenOutSymbol,
    amountIn: params.request.amountIn,
    amountInRaw: params.amountInRaw?.toString(),
    slippageBps: params.request.slippageBps,
    recipient: params.request.recipient,
    error: getErrorMessage(params.error),
  }, metadata);
}

export function logSwapTransactionEvent(
  payload: SwapTransactionLogRequest,
  metadata?: SwapRequestLogMetadata,
): void {
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
  }, metadata);
}

export function logVerifiedSwapTransactionEvent(
  payload: SwapTransactionLogRequest,
  metadata?: SwapRequestLogMetadata,
): void {
  writeSwapLog('transaction_event_verified', {
    swapEvent: 'swap_confirmed',
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
  }, metadata);
}

export function parseSwapTransactionLogRequest(body: unknown): SwapTransactionLogRequest {
  const payload = body as Partial<SwapTransactionLogRequest>;

  if (!payload || typeof payload !== 'object' || !VALID_SWAP_LOG_EVENTS.has(payload.event as SwapTransactionLogEvent)) {
    throw new Error('Invalid swap log event.');
  }

  const route = Array.isArray(payload.route)
    ? payload.route.slice(0, 8).map((step) => ({
        protocol: sanitizeLogString(step?.protocol, 32) ?? 'unknown',
        percent: Number.isFinite(Number(step?.percent)) ? Number(step.percent) : 0,
        path: Array.isArray(step?.path)
          ? step.path
              .slice(0, 8)
              .map((label: unknown) => sanitizeLogString(label, 32))
              .filter((label): label is string => Boolean(label))
          : [],
      }))
    : undefined;

  return {
    event: payload.event as SwapTransactionLogEvent,
    ownerAddress: sanitizeLogString(payload.ownerAddress, 80) as HexAddress | undefined,
    tokenInSymbol: payload.tokenInSymbol,
    tokenOutSymbol: payload.tokenOutSymbol,
    amountIn: sanitizeLogString(payload.amountIn, 80),
    amountOut: sanitizeLogString(payload.amountOut, 80),
    amountOutRaw: sanitizeLogString(payload.amountOutRaw, 120),
    minimumAmountOut: sanitizeLogString(payload.minimumAmountOut, 120),
    route,
    routerAddress: sanitizeLogString(payload.routerAddress, 80) as HexAddress | undefined,
    transactionHash: sanitizeLogString(payload.transactionHash, 80) as HexAddress | undefined,
    error: sanitizeLogString(payload.error, 1000),
    receiptStatus: sanitizeLogString(payload.receiptStatus, 32),
  };
}
