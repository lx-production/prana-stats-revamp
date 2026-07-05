import { ethers } from 'ethers';
import { POLYGON_CHAIN_ID, UNISWAP_SWAP_ROUTER_02_ADDRESS } from '../../constants/swapContracts.ts';
import type {
  HexAddress,
  SwapQuoteResponse,
  SwapTransactionVerificationRequest,
} from '../../types/swap.types.ts';
import { getServerPolygonProvider } from '../utils/providers.ts';
import { logVerifiedSwapTransactionEvent } from './swapLogs.ts';
import { verifySwapQuoteToken } from './swapQuoteVerification.ts';

const ROUTER_ADDRESS_LOWER = UNISWAP_SWAP_ROUTER_02_ADDRESS.toLowerCase();

function asVerificationRequest(body: unknown): SwapTransactionVerificationRequest {
  const payload = body as Partial<SwapTransactionVerificationRequest>;

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid swap verification request.');
  }

  if (!payload.ownerAddress || !ethers.isAddress(payload.ownerAddress)) {
    throw new Error('Invalid swap verification owner.');
  }

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

function validateQuoteShape(quote: SwapQuoteResponse, ownerAddress: HexAddress): void {
  if (quote.request.chainId !== POLYGON_CHAIN_ID) {
    throw new Error('Swap quote was not issued for Polygon.');
  }

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

export async function verifyAndLogSwapTransaction(body: unknown): Promise<void> {
  const request = asVerificationRequest(body);
  const ownerAddressLower = request.ownerAddress.toLowerCase();
  const quote = request.quote;
  const provider = await getServerPolygonProvider();

  verifySwapQuoteToken(quote);
  validateQuoteShape(quote, request.ownerAddress);

  const [transaction, receipt] = await Promise.all([
    provider.getTransaction(request.transactionHash),
    provider.getTransactionReceipt(request.transactionHash),
  ]);

  if (!transaction || !receipt) {
    throw new Error('Swap transaction is not confirmed yet.');
  }

  if (receipt.status !== 1) {
    throw new Error('Swap transaction did not succeed.');
  }

  if (transaction.from.toLowerCase() !== ownerAddressLower) {
    throw new Error('Swap transaction sender does not match the quote owner.');
  }

  if (transaction.to?.toLowerCase() !== ROUTER_ADDRESS_LOWER) {
    throw new Error('Swap transaction target is invalid.');
  }

  if (transaction.data.toLowerCase() !== quote.transaction.data.toLowerCase()) {
    throw new Error('Swap transaction calldata does not match the signed quote.');
  }

  if (transaction.value.toString() !== (quote.transaction.value || '0')) {
    throw new Error('Swap transaction value does not match the signed quote.');
  }

  logVerifiedSwapTransactionEvent({
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
  });
}
