import { loadSwapQuote } from './loaders/swapQuote.ts';
import { loadBondingQuote } from './loaders/bondingQuote.ts';
import { formatErrorForLog } from './helpers/logRedaction.ts';
import { loadStakingQuote } from './loaders/stakingQuote.ts';
import { readJsonBody, sendJson } from './helpers/requestHelpers.ts';
import { parseChecksumAddress } from './helpers/addressHelpers.ts';
import { verifyAndLogSwapTransaction } from './loaders/swapTransactionVerification.ts';
import { confirmBondingTransaction } from './loaders/bondingTransactionConfirmation.ts';
import { confirmStakingTransaction } from './loaders/stakingTransactionConfirmation.ts';
import {
  rejectInvalidSwapApiRequest,
  sanitizeSwapErrorMessage,
} from './helpers/apiRoutesHelpers.ts';
import {
  StakingApiValidationError,
  parseStakingQuoteRequest,
  sanitizeStakingErrorMessage,
} from './utils/stakingQuoteUtils.ts';
import {
  StakingConfirmationMismatchError,
  parseStakingConfirmationRequest,
} from './utils/stakingConfirmationUtils.ts';
import {
  BondingApiValidationError,
  BondingConfirmationMismatchError,
  parseBondingConfirmationRequest,
  parseBondingQuoteRequest,
} from './utils/bondingReadUtils.ts';
import { parseSwapQuoteRequest } from './utils/swapQuoteRequest.ts';
import {
  logSwapTransactionEvent,
  parseSwapTransactionLogRequest,
} from './loaders/swapLogs.ts';

import type { SwapRateLimiters } from './rateLimit.ts';
import type { RequestHandler } from './types/httpTypes.ts';
import type { SwapRequestLogMetadata } from './loaders/swapLogs.ts';
import type {
  StakingQuote,
  StakingQuoteRequest,
  StakingTransactionConfirmation,
  StakingTransactionConfirmationRequest,
} from '../features/staking/staking.types.ts';
import type {
  BondingQuote,
  BondingQuoteRequest,
  BondingTransactionConfirmation,
  BondingTransactionConfirmationRequest,
} from '../features/bonding/bonding.types.ts';

// Max request body sizes for each POST endpoint
const SWAP_QUOTE_BODY_MAX_BYTES = 2048;
const SWAP_LOG_BODY_MAX_BYTES = 8192;
const SWAP_VERIFY_BODY_MAX_BYTES = 32768;
const STAKING_BODY_MAX_BYTES = 2048;
const BONDING_BODY_MAX_BYTES = 2048;

/** Optional staking POST loader overrides so route tests do not need live RPC. */
export type StakingPostApiLoaders = {
  loadQuote: (request: StakingQuoteRequest) => Promise<StakingQuote>;
  confirmTransaction: (
    request: StakingTransactionConfirmationRequest,
  ) => Promise<StakingTransactionConfirmation>;
};

/** Optional bonding POST loader overrides for route tests (no live RPC). */
export type BondingPostApiLoaders = {
  loadQuote: (request: BondingQuoteRequest) => Promise<BondingQuote>;
  confirmTransaction: (
    request: BondingTransactionConfirmationRequest,
  ) => Promise<BondingTransactionConfirmation>;
};

/** Named loader bags so staking + bonding overrides do not collide on arg 2. */
export type PostApiLoaders = {
  staking?: Partial<StakingPostApiLoaders>;
  bonding?: Partial<BondingPostApiLoaders>;
};

const DEFAULT_STAKING_POST_API_LOADERS: StakingPostApiLoaders = {
  loadQuote: loadStakingQuote,
  confirmTransaction: confirmStakingTransaction,
};

const DEFAULT_BONDING_POST_API_LOADERS: BondingPostApiLoaders = {
  loadQuote: loadBondingQuote,
  confirmTransaction: confirmBondingTransaction,
};

// Quote + confirmation are live transaction state — never store in HTTP caches.
const STAKING_POST_CACHE_CONTROL = 'private, no-store';
const BONDING_POST_CACHE_CONTROL = 'private, no-store';

/** Safe user-facing message for staking POST validation / body / mismatch errors. */
function sanitizeStakingPostErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof StakingConfirmationMismatchError) return error.message;
  return sanitizeStakingErrorMessage(error, fallback);
}

// Headers can be string | string[]; pick the first value when it's an array
function singleHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Builds metadata attached to swap logs (IP, host, origin, user-agent)
function createSwapRequestLogMetadata(
  req: Parameters<RequestHandler>[0],
  rateLimiters: SwapRateLimiters,
): SwapRequestLogMetadata {
  return {
    clientIp: rateLimiters.getClientIp(req),
    requestHost: singleHeaderValue(req.headers.host),
    requestOrigin: singleHeaderValue(req.headers.origin),
    userAgent: singleHeaderValue(req.headers['user-agent']),
  };
}

/** Safe user-facing message for bonding POST validation / body errors. */
function sanitizeBondingErrorMessage(error: unknown, fallback: string): string {
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
function rejectIfWeb3PostAdmissionLimited(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
  rateLimiters: SwapRateLimiters,
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

// Handles POST-only swap + staking quote + bonding API routes
export function createPostApiRouteHandler(
  rateLimiters: SwapRateLimiters,
  loaders: PostApiLoaders = {},
): RequestHandler {
  const stakingLoaders: StakingPostApiLoaders = {
    ...DEFAULT_STAKING_POST_API_LOADERS,
    ...loaders.staking,
  };
  const bondingLoaders: BondingPostApiLoaders = {
    ...DEFAULT_BONDING_POST_API_LOADERS,
    ...loaders.bonding,
  };

  return async function handlePostApiRequest(req, res, url): Promise<boolean> {
    // Fully-funded Interest fund preflight for /stake/ (raw bigint, same block).
    if (url.pathname === '/api/staking/quote') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        sendJson(res, 405, {
          error: 'method_not_allowed',
          message: 'Use POST for staking quotes.',
        });
        return true;
      }

      // Shared admission → validate → parse → then scarce quote RPC budget.
      if (rejectIfWeb3PostAdmissionLimited(req, res, rateLimiters)) return true;
      if (rejectInvalidSwapApiRequest(req, res)) return true;

      try {
        const body = await readJsonBody<unknown>(req, STAKING_BODY_MAX_BYTES);
        const request = parseStakingQuoteRequest(body);

        if (rateLimiters.isStakingQuoteRateLimited(req)) {
          sendJson(res, 429, {
            error: 'rate_limited',
            message: 'Too many staking quote requests. Please wait a moment and try again.',
          });
          return true;
        }

        const result = await stakingLoaders.loadQuote(request);
        // Soft issues (e.g. insufficient_interest_fund) still return 200.
        sendJson(res, 200, result, { cacheControl: STAKING_POST_CACHE_CONTROL });
        return true;
      } catch (err) {
        if (
          err instanceof StakingApiValidationError ||
          err instanceof SyntaxError ||
          (err instanceof Error &&
            (err.message === 'Request body is required.' ||
              err.message === 'Request body is too large.'))
        ) {
          sendJson(res, 400, {
            error: 'invalid_request',
            message: sanitizeStakingErrorMessage(err, 'Invalid staking quote request.'),
          });
          return true;
        }

        console.error('Failed to load staking quote:', formatErrorForLog(err));
        sendJson(res, 502, {
          error: 'upstream_unavailable',
          message: 'Failed to load staking quote.',
        });
        return true;
      }
    }

    if (url.pathname === '/api/staking/confirm-transaction') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        sendJson(res, 405, {
          error: 'method_not_allowed',
          message: 'Use POST for staking transaction confirmation.',
        });
        return true;
      }

      // Shared admission → validate → parse → then confirmation RPC budget.
      if (rejectIfWeb3PostAdmissionLimited(req, res, rateLimiters)) return true;
      if (rejectInvalidSwapApiRequest(req, res)) return true;

      try {
        const body = await readJsonBody<unknown>(req, STAKING_BODY_MAX_BYTES);
        const request = parseStakingConfirmationRequest(body, parseChecksumAddress);

        if (rateLimiters.isStakingConfirmRateLimited(req)) {
          sendJson(res, 429, {
            error: 'rate_limited',
            message: 'Too many staking confirmation requests.',
          });
          return true;
        }

        const result = await stakingLoaders.confirmTransaction(request);
        sendJson(res, 200, result, { cacheControl: STAKING_POST_CACHE_CONTROL });
        return true;
      } catch (err) {
        if (
          err instanceof StakingApiValidationError ||
          err instanceof StakingConfirmationMismatchError ||
          err instanceof SyntaxError ||
          (err instanceof Error &&
            (err.message === 'Request body is required.' ||
              err.message === 'Request body is too large.'))
        ) {
          sendJson(res, 400, {
            error:
              err instanceof StakingConfirmationMismatchError
                ? 'confirmation_mismatch'
                : 'invalid_request',
            message: sanitizeStakingPostErrorMessage(
              err,
              'Invalid staking confirmation request.',
            ),
          });
          return true;
        }

        console.error('Failed to confirm staking transaction:', formatErrorForLog(err));
        sendJson(res, 502, {
          error: 'upstream_unavailable',
          message: 'Failed to confirm staking transaction.',
        });
        return true;
      }
    }

    if (url.pathname === '/api/swap/quote') {
      // Reject anything that isn't POST
      if (req.method !== 'POST') {
        sendJson(res, 405, {
          error: 'method_not_allowed',
          message: 'Use POST for swap quotes.',
        });
        return true;
      }

      // Shared admission → validate → parse → then scarce quote RPC budget.
      if (rejectIfWeb3PostAdmissionLimited(req, res, rateLimiters)) return true;
      if (rejectInvalidSwapApiRequest(req, res)) return true;

      try {
        const body = await readJsonBody<unknown>(req, SWAP_QUOTE_BODY_MAX_BYTES);
        const request = parseSwapQuoteRequest(body);

        if (rateLimiters.isSwapQuoteRateLimited(req)) {
          sendJson(res, 429, {
            error: 'rate_limited',
            message: 'Too many swap quote requests. Please wait a moment and try again.',
          });
          return true;
        }

        const result = await loadSwapQuote(request, createSwapRequestLogMetadata(req, rateLimiters));
        sendJson(res, 200, result);
        return true;
      } catch (err) {
        sendJson(res, 400, {
          error: 'quote_failed',
          message: sanitizeSwapErrorMessage(err, 'Failed to load swap quote.'),
        });
        return true;
      }
    }

    if (url.pathname === '/api/swap/log') {
      if (req.method !== 'POST') {
        sendJson(res, 405, {
          error: 'method_not_allowed',
          message: 'Use POST for swap logs.',
        });
        return true;
      }

      // Shared admission first; log budget still protects ingestion after that.
      if (rejectIfWeb3PostAdmissionLimited(req, res, rateLimiters)) return true;

      if (rateLimiters.isSwapLogRateLimited(req)) {
        sendJson(res, 429, {
          error: 'rate_limited',
          message: 'Too many swap log requests.',
        });
        return true;
      }

      if (rejectInvalidSwapApiRequest(req, res)) return true;

      try {
        const body = await readJsonBody<unknown>(req, SWAP_LOG_BODY_MAX_BYTES);
        const payload = parseSwapTransactionLogRequest(body);
        logSwapTransactionEvent(payload, createSwapRequestLogMetadata(req, rateLimiters));
        sendJson(res, 200, { ok: true });
        return true;
      } catch (err) {
        sendJson(res, 400, {
          error: 'log_failed',
          message: sanitizeSwapErrorMessage(err, 'Failed to write swap log.'),
        });
        return true;
      }
    }

    if (url.pathname === '/api/swap/verify-transaction') {
      if (req.method !== 'POST') {
        sendJson(res, 405, {
          error: 'method_not_allowed',
          message: 'Use POST for swap transaction verification.',
        });
        return true;
      }

      // Shared admission first; verify budget stays per-IP (no global RPC quota yet).
      if (rejectIfWeb3PostAdmissionLimited(req, res, rateLimiters)) return true;

      if (rateLimiters.isSwapVerifyRateLimited(req)) {
        sendJson(res, 429, {
          error: 'rate_limited',
          message: 'Too many swap verification requests.',
        });
        return true;
      }

      if (rejectInvalidSwapApiRequest(req, res)) return true;

      try {
        const body = await readJsonBody<unknown>(req, SWAP_VERIFY_BODY_MAX_BYTES);
        await verifyAndLogSwapTransaction(body, {
          logMetadata: createSwapRequestLogMetadata(req, rateLimiters),
        });
        sendJson(res, 200, { ok: true, verified: true });
        return true;
      } catch (err) {
        sendJson(res, 400, {
          error: 'verification_failed',
          message: sanitizeSwapErrorMessage(err, 'Failed to verify swap transaction.'),
        });
        return true;
      }
    }

    if (url.pathname === '/api/bonding/quote') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        sendJson(res, 405, {
          error: 'method_not_allowed',
          message: 'Use POST for bonding quotes.',
        });
        return true;
      }

      // Shared admission → Content-Type / origin → body/shape → then RPC quote budget.
      if (rejectIfWeb3PostAdmissionLimited(req, res, rateLimiters)) return true;
      if (rejectInvalidSwapApiRequest(req, res)) return true;

      try {
        const body = await readJsonBody<unknown>(req, BONDING_BODY_MAX_BYTES);
        const request = parseBondingQuoteRequest(body);

        // Consume per-IP + global quote budget only after shape validation.
        if (rateLimiters.isBondingQuoteRateLimited(req)) {
          sendJson(res, 429, {
            error: 'rate_limited',
            message: 'Too many bonding quote requests.',
          });
          return true;
        }

        const result = await bondingLoaders.loadQuote(request);
        // Non-executable quotes still return 200 with issues for the form.
        sendJson(res, 200, result, { cacheControl: BONDING_POST_CACHE_CONTROL });
        return true;
      } catch (err) {
        if (
          err instanceof BondingApiValidationError ||
          err instanceof SyntaxError ||
          (err instanceof Error &&
            (err.message === 'Request body is required.' ||
              err.message === 'Request body is too large.'))
        ) {
          sendJson(res, 400, {
            error: 'invalid_request',
            message: sanitizeBondingErrorMessage(err, 'Invalid bonding quote request.'),
          });
          return true;
        }

        console.error('Failed to load bonding quote:', formatErrorForLog(err));
        sendJson(res, 502, {
          error: 'upstream_unavailable',
          message: 'Failed to load bonding quote.',
        });
        return true;
      }
    }

    if (url.pathname === '/api/bonding/confirm-transaction') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        sendJson(res, 405, {
          error: 'method_not_allowed',
          message: 'Use POST for bonding transaction confirmation.',
        });
        return true;
      }

      // Shared admission → validate → parse → then confirmation RPC budget.
      if (rejectIfWeb3PostAdmissionLimited(req, res, rateLimiters)) return true;
      if (rejectInvalidSwapApiRequest(req, res)) return true;

      try {
        const body = await readJsonBody<unknown>(req, BONDING_BODY_MAX_BYTES);
        const request = parseBondingConfirmationRequest(body, parseChecksumAddress);

        if (rateLimiters.isBondingConfirmRateLimited(req)) {
          sendJson(res, 429, {
            error: 'rate_limited',
            message: 'Too many bonding confirmation requests.',
          });
          return true;
        }

        const result = await bondingLoaders.confirmTransaction(request);
        sendJson(res, 200, result, { cacheControl: BONDING_POST_CACHE_CONTROL });
        return true;
      } catch (err) {
        if (
          err instanceof BondingApiValidationError ||
          err instanceof BondingConfirmationMismatchError ||
          err instanceof SyntaxError ||
          (err instanceof Error &&
            (err.message === 'Request body is required.' ||
              err.message === 'Request body is too large.'))
        ) {
          sendJson(res, 400, {
            error:
              err instanceof BondingConfirmationMismatchError
                ? 'confirmation_mismatch'
                : 'invalid_request',
            message: sanitizeBondingErrorMessage(
              err,
              'Invalid bonding confirmation request.',
            ),
          });
          return true;
        }

        console.error('Failed to confirm bonding transaction:', formatErrorForLog(err));
        sendJson(res, 502, {
          error: 'upstream_unavailable',
          message: 'Failed to confirm bonding transaction.',
        });
        return true;
      }
    }

    // Not a POST API route — let the next handler try
    return false;
  };
}
