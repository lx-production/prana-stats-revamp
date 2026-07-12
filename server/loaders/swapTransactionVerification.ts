import { ethers } from 'ethers';
import { getServerPolygonProvider } from '../utils/providers.ts';
import { logVerifiedSwapTransactionEvent, type SwapRequestLogMetadata } from './swapLogs.ts';
import { POLYGON_CHAIN_ID, UNISWAP_SWAP_ROUTER_02_ADDRESS } from '../../constants/swapContracts.ts';
import { assertSwapQuoteTokenUnused, markSwapQuoteTokenUsed, verifySwapQuoteToken } from './swapQuoteVerification.ts';

import type { HexAddress, SwapQuoteResponse, SwapTransactionVerificationRequest } from '../../types/swap.types.ts';

/**
 * Confirms an on-chain swap and writes a verified log entry.
 *
 * Why it exists:
 * The browser can claim “I swapped.” We must prove that against Polygon:
 * the tx succeeded, came from the quote owner, and matches the signed quote
 * (router, calldata, value) — so clients can’t invent fake swap analytics.
 *
 * Flow:
 * 1. Validate the POST body shape (owner, tx hash, quote)
 * 2. Check the quote’s HMAC token + shape + replay guard
 * 3. Load the tx + receipt from Polygon
 * 4. Assert sender / target / calldata / value match the quote
 * 5. Log `swap_confirmed` and mark the quote token used
 */

// Lowercase once so every address compare is a cheap string equality.
const ROUTER_ADDRESS_LOWER = UNISWAP_SWAP_ROUTER_02_ADDRESS.toLowerCase();

/** Minimal RPC surface we need — real provider or a test double. */
type SwapTransactionLookupProvider = {
  getTransaction(hash: string): Promise<{
    from: string;
    to?: string | null;
    data: string;
    value: { toString(): string };
  } | null>;
  getTransactionReceipt(hash: string): Promise<{
    status: number | null;
  } | null>;
};

/**
 * Optional overrides for tests (mock provider / logger) and request log metadata.
 * Production callers leave this empty and get the real Polygon provider + logger.
 */
type SwapTransactionVerificationDependencies = {
  getProvider?: () => Promise<SwapTransactionLookupProvider>;
  logVerifiedSwapTransactionEvent?: typeof logVerifiedSwapTransactionEvent;
  logMetadata?: SwapRequestLogMetadata;
};

/** Parse + validate the POST body into a typed verification request. */
function asVerificationRequest(body: unknown): SwapTransactionVerificationRequest {
  const payload = body as Partial<SwapTransactionVerificationRequest>;

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid swap verification request.');
  }

  // Owner must be a real EVM address (checksummed or not — ethers accepts both).
  if (!payload.ownerAddress || !ethers.isAddress(payload.ownerAddress)) {
    throw new Error('Invalid swap verification owner.');
  }

  // Tx hashes are always 32 bytes = 66 chars with 0x prefix.
  if (!payload.transactionHash || !/^0x[0-9a-fA-F]{64}$/.test(payload.transactionHash)) {
    throw new Error('Invalid swap verification transaction hash.');
  }

  if (!payload.quote || typeof payload.quote !== 'object') {
    throw new Error('Invalid swap verification quote.');
  }

  return {
    ownerAddress: payload.ownerAddress,
    transactionHash: payload.transactionHash,
    quote: payload.quote as SwapQuoteResponse,
  };
}

/**
 * Cheap shape checks before we burn an RPC call.
 * HMAC already covers tampering; this catches obvious mismatches early
 * (wrong chain, wrong recipient, wrong router).
 */
function validateQuoteShape(quote: SwapQuoteResponse, ownerAddress: HexAddress): void {
  if (quote.request.chainId !== POLYGON_CHAIN_ID) {
    throw new Error('Swap quote was not issued for Polygon.');
  }

  // The quote’s recipient must be the same wallet that submitted verification.
  if (quote.request.recipient.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error('Swap quote recipient does not match the transaction owner.');
  }

  if (quote.routerAddress.toLowerCase() !== ROUTER_ADDRESS_LOWER) {
    throw new Error('Swap quote router is invalid.');
  }

  if (quote.transaction.to.toLowerCase() !== ROUTER_ADDRESS_LOWER) {
    throw new Error('Swap quote transaction target is invalid.');
  }
}

/**
 * Main entry: verify the on-chain swap matches the signed quote, then log it.
 * Throws on any mismatch — the route handler turns that into a 4xx/5xx response.
 */
export async function verifyAndLogSwapTransaction(
  body: unknown,
  dependencies: SwapTransactionVerificationDependencies = {},
): Promise<void> {
  const request = asVerificationRequest(body);
  const ownerAddressLower = request.ownerAddress.toLowerCase();
  const quote = request.quote;
  // Allow tests to inject a fake provider / logger without hitting real RPC.
  const loadProvider = dependencies.getProvider ?? getServerPolygonProvider;
  const writeVerifiedLog = dependencies.logVerifiedSwapTransactionEvent ?? logVerifiedSwapTransactionEvent;

  // 1) Prove the quote was issued by this server (HMAC).
  verifySwapQuoteToken(quote);
  // 2) Quick shape checks (chain, recipient, router).
  validateQuoteShape(quote, request.ownerAddress);
  // 3) Reject if this quote token was already used (anti-replay / RPC amp).
  assertSwapQuoteTokenUnused(quote);

  // Fetch tx + receipt in parallel — both are required to confirm the swap.
  const provider = await loadProvider();
  const [transaction, receipt] = await Promise.all([
    provider.getTransaction(request.transactionHash),
    provider.getTransactionReceipt(request.transactionHash),
  ]);

  // Missing either means the tx isn’t mined yet (or hash is wrong).
  if (!transaction || !receipt) {
    throw new Error('Swap transaction is not confirmed yet.');
  }

  // status === 1 means the EVM execution succeeded (0 = reverted).
  if (receipt.status !== 1) {
    throw new Error('Swap transaction did not succeed.');
  }

  // Sender on-chain must be the wallet that owns the quote.
  if (transaction.from.toLowerCase() !== ownerAddressLower) {
    throw new Error('Swap transaction sender does not match the quote owner.');
  }

  // Must have called SwapRouter02, not some other contract.
  if (transaction.to?.toLowerCase() !== ROUTER_ADDRESS_LOWER) {
    throw new Error('Swap transaction target is invalid.');
  }

  // Calldata must be byte-for-byte what we signed into the quote.
  if (transaction.data.toLowerCase() !== quote.transaction.data.toLowerCase()) {
    throw new Error('Swap transaction calldata does not match the signed quote.');
  }

  // Native MATIC/ETH attached to the call (usually "0" for ERC-20 swaps).
  if (transaction.value.toString() !== (quote.transaction.value || '0')) {
    throw new Error('Swap transaction value does not match the signed quote.');
  }

  // All checks passed — record a confirmed swap for analytics.
  writeVerifiedLog({
    event: 'swap_confirmed',
    ownerAddress: request.ownerAddress,
    tokenInSymbol: quote.tokenIn.symbol,
    tokenOutSymbol: quote.tokenOut.symbol,
    amountIn: quote.amountIn,
    amountOut: quote.amountOut,
    amountOutRaw: quote.amountOutRaw,
    minimumAmountOut: quote.minimumAmountOut,
    route: quote.route,
    routerAddress: quote.routerAddress,
    transactionHash: request.transactionHash,
    receiptStatus: 'success',
  }, dependencies.logMetadata);

  // Sticky “already verified” so the same token can’t trigger another RPC round-trip.
  markSwapQuoteTokenUsed(quote);
}
