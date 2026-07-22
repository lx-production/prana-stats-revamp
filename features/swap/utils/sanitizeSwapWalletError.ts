/**
 * Maps raw wallet / viem errors to short UI-safe messages.
 * Keeps approve/swap failures from dumping long calldata into the modal.
 */

/** Friendly messages we throw ourselves in the swap hook — show as-is. */
const KNOWN_SWAP_UI_MESSAGES = new Set([
  'Load a quote before swapping.',
  'Quote expired. Refresh to continue.',
  'Refresh the quote before swapping.',
  'Connect your Polygon wallet before swapping.',
  'Connect your Polygon wallet before approving.',
  'Approval transaction reverted.',
  'Swap transaction reverted.',
]);

/** Detect EIP-1193 / viem "user canceled in wallet" errors (including nested causes). */
function isUserRejectedRequest(error: unknown): boolean {
  let current: unknown = error;

  // Walk a short cause chain — wagmi/viem often wrap the wallet rejection.
  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (typeof current !== 'object' || current === null) break;

    const candidate = current as {
      code?: unknown;
      name?: unknown;
      message?: unknown;
      shortMessage?: unknown;
      details?: unknown;
      cause?: unknown;
    };

    // MetaMask / EIP-1193: 4001 = user rejected the request
    if (candidate.code === 4001 || candidate.code === 'ACTION_REJECTED') {
      return true;
    }

    if (candidate.name === 'UserRejectedRequestError') {
      return true;
    }

    const text = [candidate.shortMessage, candidate.message, candidate.details]
      .filter((part): part is string => typeof part === 'string')
      .join(' ')
      .toLowerCase();

    if (
      text.includes('user rejected') ||
      text.includes('user denied') ||
      text.includes('rejected the request') ||
      text.includes('request rejected')
    ) {
      return true;
    }

    current = candidate.cause;
  }

  return false;
}

/**
 * Returns a short message safe to render in the swap modal.
 * User cancellations get a clear cancel message; unknown internals use `fallback`.
 */
export function sanitizeSwapWalletError(
  error: unknown,
  fallback = 'Transaction failed. Please try again.',
): string {
  if (error instanceof Error && KNOWN_SWAP_UI_MESSAGES.has(error.message)) {
    return error.message;
  }

  // Insufficient balance messages are dynamic: "Insufficient USDT balance."
  if (error instanceof Error && /^Insufficient .+ balance\.$/.test(error.message)) {
    return error.message;
  }

  if (isUserRejectedRequest(error)) {
    return 'Transaction canceled.';
  }

  return fallback;
}
