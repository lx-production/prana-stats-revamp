import { sendJson } from './requestHelpers.ts';
import { sanitizeStakingErrorMessage } from '../utils/stakingQuoteUtils.ts';
import { StakingConfirmationMismatchError } from '../utils/stakingConfirmationUtils.ts';
import { BondingApiValidationError, BondingConfirmationMismatchError } from '../utils/bondingReadUtils.ts';

import type { Web3RateLimiters } from '../rateLimit.ts';
import type { RequestHandler } from '../types/httpTypes.ts';
import type { SwapRequestLogMetadata } from '../loaders/swapLogs.ts';

/** Safe user-facing message for staking POST validation / body / mismatch errors. */
export function sanitizeStakingPostErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof StakingConfirmationMismatchError) return error.message;
  return sanitizeStakingErrorMessage(error, fallback);
}

// Headers can be string | string[]; pick the first value when it's an array
function singleHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Builds metadata attached to swap logs (IP, host, origin, user-agent)
export function createSwapRequestLogMetadata(
  req: Parameters<RequestHandler>[0],
  rateLimiters: Web3RateLimiters,
): SwapRequestLogMetadata {
  return {
    clientIp: rateLimiters.getClientIp(req),
    requestHost: singleHeaderValue(req.headers.host),
    requestOrigin: singleHeaderValue(req.headers.origin),
    userAgent: singleHeaderValue(req.headers['user-agent']),
  };
}

/** Safe user-facing message for bonding POST validation / body errors. */
export function sanitizeBondingErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof BondingApiValidationError) return error.message;
  if (error instanceof BondingConfirmationMismatchError) return error.message;
  if (error instanceof SyntaxError) return 'Invalid JSON request body.';
  if (error instanceof Error) {
    const allowed = [
      'Request body is required.',
      'Request body is too large.',
      'Expected application/json request body.',
      'Cross-origin swap API requests are not allowed.',
    ];
    if (allowed.includes(error.message)) return error.message;
  }
  return fallback;
}

/**
 * Shared cheap admission for all Web3 POSTs — before body parse / expensive budgets.
 * Returns true when the response was already sent.
 */
export function rejectIfWeb3PostAdmissionLimited(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
  rateLimiters: Web3RateLimiters,
): boolean {
  if (rateLimiters.isWeb3PostAdmissionRateLimited(req)) {
    sendJson(res, 429, {
      error: 'rate_limited',
      message: 'Too many API requests. Please wait a moment and try again.',
    });
    return true;
  }
  return false;
}
