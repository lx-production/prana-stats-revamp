import type {
  HexAddress,
  SwapQuoteResponse,
  SwapTransactionLogEvent,
  SwapTransactionLogRequest,
  SwapTransactionVerificationRequest,
} from '../../../types/swap.types';

function getErrorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Uses the backend's independent Polygon RPC to prove that a submitted swap
 * succeeded and matched its signed quote.
 */
export async function verifySwapTransaction(
  payload: SwapTransactionVerificationRequest,
): Promise<void> {
  const response = await fetch('/api/swap/verify-transaction', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('The server could not verify the swap transaction.');
  }
}

export function logSwapTransactionEvent(input: {
  event: SwapTransactionLogEvent;
  quote?: SwapQuoteResponse | null;
  ownerAddress?: HexAddress;
  transactionHash?: HexAddress;
  error?: unknown;
  receiptStatus?: string;
}): void {
  if (
    input.event === 'swap_confirmed' &&
    input.quote &&
    input.ownerAddress &&
    input.transactionHash
  ) {
    const payload: SwapTransactionVerificationRequest = {
      ownerAddress: input.ownerAddress,
      transactionHash: input.transactionHash,
      quote: input.quote,
    };

    void verifySwapTransaction(payload).catch(() => undefined);
    return;
  }

  const payload: SwapTransactionLogRequest = {
    event: input.event,
    ownerAddress: input.ownerAddress,
    tokenInSymbol: input.quote?.tokenIn.symbol,
    tokenOutSymbol: input.quote?.tokenOut.symbol,
    amountIn: input.quote?.amountIn,
    amountOut: input.quote?.amountOut,
    amountOutRaw: input.quote?.amountOutRaw,
    minimumAmountOut: input.quote?.minimumAmountOut,
    route: input.quote?.route,
    routerAddress: input.quote?.routerAddress,
    transactionHash: input.transactionHash,
    error: getErrorMessage(input.error),
    receiptStatus: input.receiptStatus,
  };

  void fetch('/api/swap/log', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}
