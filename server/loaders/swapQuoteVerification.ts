import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { SwapQuoteResponse, SwapQuoteVerification } from '../../types/swap.types.ts';

const TOKEN_VERSION = 1;
const FALLBACK_SIGNING_SECRET = randomBytes(32).toString('hex');
const QUOTE_VERIFICATION_TTL_SECONDS = 30 * 60;

type SignableSwapQuote = Omit<SwapQuoteResponse, 'verification'>;

function getSigningSecret(): string {
  return process.env.SWAP_QUOTE_SIGNING_SECRET || FALLBACK_SIGNING_SECRET;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function normalizeQuoteForSigning(quote: SignableSwapQuote): Record<string, unknown> {
  return {
    request: quote.request,
    tokenInSymbol: quote.tokenIn.symbol,
    tokenOutSymbol: quote.tokenOut.symbol,
    amountIn: quote.amountIn,
    amountOutRaw: quote.amountOutRaw,
    minimumAmountOut: quote.minimumAmountOut,
    routerAddress: quote.routerAddress.toLowerCase(),
    transaction: {
      to: quote.transaction.to.toLowerCase(),
      data: quote.transaction.data.toLowerCase(),
      value: quote.transaction.value,
    },
    deadline: quote.deadline,
  };
}

function signPayload(payload: Record<string, unknown>, issuedAt: string, expiresAt: string): string {
  return createHmac('sha256', getSigningSecret())
    .update(stableStringify({
      version: TOKEN_VERSION,
      issuedAt,
      expiresAt,
      quote: payload,
    }))
    .digest('hex');
}

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

export function verifySwapQuoteToken(quote: SwapQuoteResponse): void {
  const { verification, ...signableQuote } = quote;

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
