import { parseUnsignedDecimalRaw } from './parseUnsignedDecimalRaw.ts';

import type { StakingQuoteRequest } from '../../features/staking/staking.types.ts';

export { parseUnsignedDecimalRaw } from './parseUnsignedDecimalRaw.ts';

/** Thrown for bad quote bodies so the route can map to HTTP 400 (not 502). */
export class StakingApiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StakingApiValidationError';
  }
}

/** Validate POST /api/staking/quote JSON body. */
export function parseStakingQuoteRequest(body: unknown): StakingQuoteRequest {
  if (!body || typeof body !== 'object') {
    throw new StakingApiValidationError('Invalid staking quote request.');
  }

  const payload = body as Record<string, unknown>;
  const amountRaw = parseUnsignedDecimalRaw(payload.amountRaw);
  if (amountRaw === null) {
    throw new StakingApiValidationError('Invalid staking quote amount.');
  }

  const durationSeconds = payload.durationSeconds;
  if (
    typeof durationSeconds !== 'number' ||
    !Number.isInteger(durationSeconds) ||
    durationSeconds <= 0
  ) {
    throw new StakingApiValidationError('Invalid staking quote duration.');
  }

  return {
    amountRaw: amountRaw.toString(),
    durationSeconds,
  };
}

/** Pass through known validation messages; redact everything else. */
export function sanitizeStakingErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (!(error instanceof Error)) return fallback;

  const allowedMessages = [
    'Invalid staking quote request.',
    'Invalid staking quote amount.',
    'Invalid staking quote duration.',
    'Request body is required.',
    'Request body is too large.',
    'Expected application/json request body.',
    'Cross-origin swap API requests are not allowed.',
  ];

  if (allowedMessages.includes(error.message)) return error.message;
  if (error instanceof SyntaxError) return 'Invalid JSON request body.';
  return fallback;
}
