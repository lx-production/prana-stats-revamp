import { loadSwapQuote } from './loaders/swapQuote.ts';
import { readJsonBody, sendJson } from './helpers/requestHelpers.ts';
import { verifyAndLogSwapTransaction } from './loaders/swapTransactionVerification.ts';
import { rejectInvalidSwapApiRequest, sanitizeSwapErrorMessage } from './helpers/apiRoutesHelpers.ts';
import { logSwapTransactionEvent, parseSwapTransactionLogRequest, type SwapRequestLogMetadata } from './loaders/swapLogs.ts';

import type { SwapRateLimiters } from './rateLimit.ts';
import type { RequestHandler } from './types/httpTypes.ts';
import type { SwapQuoteRequest } from '../types/swap.types.ts';

// Max request body sizes for each POST endpoint
const SWAP_QUOTE_BODY_MAX_BYTES = 2048;
const SWAP_LOG_BODY_MAX_BYTES = 8192;
const SWAP_VERIFY_BODY_MAX_BYTES = 32768;

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

// Handles POST-only swap API routes (quote, log, verify-transaction)
export function createPostApiRouteHandler(rateLimiters: SwapRateLimiters): RequestHandler {
  return async function handlePostApiRequest(req, res, url): Promise<boolean> {
    if (url.pathname === '/api/swap/quote') {
      // Reject anything that isn't POST
      if (req.method !== 'POST') {
        sendJson(res, 405, {
          error: 'method_not_allowed',
          message: 'Use POST for swap quotes.',
        });
        return true;
      }

      if (rateLimiters.isSwapQuoteRateLimited(req)) {
        sendJson(res, 429, {
          error: 'rate_limited',
          message: 'Too many swap quote requests. Please wait a moment and try again.',
        });
        return true;
      }

      // Origin / content-type checks for swap APIs
      if (rejectInvalidSwapApiRequest(req, res)) return true;

      // these lines run only when the inner if conditions were false
      try {
        const body = await readJsonBody<SwapQuoteRequest>(req, SWAP_QUOTE_BODY_MAX_BYTES);
        const result = await loadSwapQuote(body, createSwapRequestLogMetadata(req, rateLimiters));
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

    // Not a POST API route — let the next handler try
    return false;
  };
}
