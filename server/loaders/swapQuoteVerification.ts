import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { SwapQuoteResponse, SwapQuoteVerification } from '../../types/swap.types.ts';

/**
 * HMAC “proof” that a swap quote was issued by this server.
 *
 * Why it exists:
 * After the user swaps, the browser can POST the quote + tx hash to
 * `/api/swap/verify-transaction`. We must trust that the quote fields
 * (router, calldata, amounts, etc.) were not edited client-side.
 *
 * Flow:
 * 1. loadSwapQuote finishes → attachSwapQuoteVerification() signs the quote
 * 2. Browser stores the quote (including verification.token) and later sends it back
 * 3. verifyAndLogSwapTransaction() calls verifySwapQuoteToken() then replay guards
 * 4. On success, markSwapQuoteTokenUsed() so the same token can’t burn RPC again
 */

// Bump this when the signed payload shape changes (old tokens become invalid).
const TOKEN_VERSION = 2;

// Random HMAC key for this Node process. Tokens are invalid after restart
// (and across different workers) — same tradeoff as the in-memory replay cache.
const SIGNING_SECRET = randomBytes(32).toString('hex');

// How long a signed quote stays usable for verify-transaction (5 minutes).
// Slightly longer than SWAP_DEADLINE_SECONDS (3 min) so confirm + verify can finish.
const QUOTE_VERIFICATION_TTL_SECONDS = 5 * 60;

// It’s a “this quote token was already verified” sticky note, kept in RAM.
// In-memory replay cache: sha256(token) → expiresAt (ms).
// Survives only for this Node process; cleared on restart (acceptable for RPC anti-amplification).
const usedSwapQuoteTokenHashes = new Map<string, number>();

/** Quote fields we sign — everything except the verification blob itself. */
type SignableSwapQuote = Omit<SwapQuoteResponse, 'verification'>;

/**
 * turns any value into a string that always looks the same for the same data — 
 * even if object keys were in a different order.
 * Plain JSON.stringify is unsafe for signing because key order can differ.
 * Normal JSON.stringify does not guarantee key order
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      // sort keys alphabetically (a before b)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

/**
 * Pick the fields that must not be tampered with, and normalize addresses
 * so `0xAbC` and `0xabc` produce the same signature.
 */
function normalizeQuoteForSigning(quote: SignableSwapQuote): Record<string, unknown> {
  return {
    request: quote.request,
    tokenInSymbol: quote.tokenIn.symbol,
    tokenOutSymbol: quote.tokenOut.symbol,
    amountIn: quote.amountIn,
    amountOut: quote.amountOut,
    amountOutRaw: quote.amountOutRaw,
    minimumAmountOut: quote.minimumAmountOut,
    route: quote.route,
    routerAddress: quote.routerAddress.toLowerCase(),
    transaction: {
      to: quote.transaction.to.toLowerCase(),
      data: quote.transaction.data.toLowerCase(),
      value: quote.transaction.value,
    },
    deadline: quote.deadline,
  };
}

/** HMAC-SHA256 over version + timestamps + normalized quote → hex token. */
function signPayload(payload: Record<string, unknown>, issuedAt: string, expiresAt: string): string {
  return createHmac('sha256', SIGNING_SECRET)
    .update(stableStringify({
      version: TOKEN_VERSION,
      issuedAt,
      expiresAt,
      quote: payload,
    }))
    .digest('hex');
}

/**
 * Read + basic-shape-check the verification blob on an incoming quote.
 * Does not check HMAC yet — callers use verifySwapQuoteToken for that.
 */
function getQuoteVerification(quote: SwapQuoteResponse): { verification: SwapQuoteVerification; expiresAt: number } {
  const { verification } = quote;

  if (
    !verification ||
    verification.version !== TOKEN_VERSION ||
    typeof verification.issuedAt !== 'string' ||
    typeof verification.expiresAt !== 'string' ||
    typeof verification.token !== 'string'
  ) {
    throw new Error('Swap quote verification is missing.');
  }

  const expiresAt = Date.parse(verification.expiresAt);
  if (!Number.isFinite(expiresAt)) {
    throw new Error('Swap quote verification has expired.');
  }

  return { verification, expiresAt };
}

/** Hash the raw HMAC token so we don’t store the secret material in the replay map. */
function hashSwapQuoteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Drop expired replay entries so the in-memory map stays bounded. */
function sweepUsedSwapQuoteTokens(now = Date.now()): void {
  for (const [tokenHash, expiresAt] of usedSwapQuoteTokenHashes) {
    if (expiresAt <= now) {
      usedSwapQuoteTokenHashes.delete(tokenHash);
    }
  }
}

/**
 * Called at the end of loadSwapQuote (primary + fallback).
 * Attaches issuedAt / expiresAt / HMAC token so the browser can prove this quote later.
 */
export function attachSwapQuoteVerification(quote: SignableSwapQuote): SwapQuoteResponse {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + QUOTE_VERIFICATION_TTL_SECONDS * 1000);
  const verification: SwapQuoteVerification = {
    version: TOKEN_VERSION,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    token: signPayload(normalizeQuoteForSigning(quote), issuedAt.toISOString(), expiresAt.toISOString()),
  };

  return {
    ...quote,
    verification,
  };
}

/**
 * Recompute the HMAC from the quote body and compare to verification.token.
 * timingSafeEqual avoids leaking which bytes mismatched via response timing.
 * Throws if missing, expired, or tampered.
 */
export function verifySwapQuoteToken(quote: SwapQuoteResponse): void {
  const { verification, ...signableQuote } = quote;

  const { expiresAt } = getQuoteVerification(quote);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    throw new Error('Swap quote verification has expired.');
  }

  const expected = signPayload(
    normalizeQuoteForSigning(signableQuote),
    verification.issuedAt,
    verification.expiresAt,
  );

  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(verification.token, 'hex');

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new Error('Swap quote verification is invalid.');
  }
}

/**
 * Replay guard (check only): reject if this token already produced a verified log.
 * Call this *before* paid RPC lookups so repeats don’t burn Alchemy quota.
 */
export function assertSwapQuoteTokenUnused(quote: SwapQuoteResponse): void {
  const { verification } = getQuoteVerification(quote);
  sweepUsedSwapQuoteTokens();

  if (usedSwapQuoteTokenHashes.has(hashSwapQuoteToken(verification.token))) {
    throw new Error('Swap quote verification has already been used.');
  }
}

/**
 * Replay guard (mark used): call only after on-chain checks + verified log succeed.
 * Failed / pending verifies must NOT mark, so a later confirmation can still retry.
 */
export function markSwapQuoteTokenUsed(quote: SwapQuoteResponse): void {
  const { verification, expiresAt } = getQuoteVerification(quote);
  sweepUsedSwapQuoteTokens();
  usedSwapQuoteTokenHashes.set(hashSwapQuoteToken(verification.token), expiresAt);
}

/** Test-only helpers for the in-memory replay cache. */
export const swapQuoteVerificationTestUtils = {
  clearUsedSwapQuoteTokens(): void {
    usedSwapQuoteTokenHashes.clear();
  },
  getUsedSwapQuoteTokenCount(): number {
    return usedSwapQuoteTokenHashes.size;
  },
  sweepUsedSwapQuoteTokens,
};
