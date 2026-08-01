import type {
  ConfirmTransactionOnChainParams,
  OnChainConfirmationResult,
} from '../types/transactionConfirmationTypes.ts';

/**
 * Shared Polygon RPC confirmation for Staking/Bonding.
 * Validates sender + expected target/calldata, then maps receipt status.
 * Provider init / read failures → confirmation_unavailable (never "reverted").
 * Missing tx or receipt → not_mined. status null → confirmation_unavailable.
 *
 * Does not cover Swap: Swap also checks value / quote HMAC / other metadata.
 */
export async function confirmTransactionOnChain(
  params: ConfirmTransactionOnChainParams,
): Promise<OnChainConfirmationResult> {
  const {
    account,
    expectedCall,
    getProvider,
    transactionHash,
    createMismatchError,
  } = params;

  let provider;
  try {
    provider = await getProvider();
  } catch {
    return { status: 'confirmation_unavailable' };
  }

  let transaction: Awaited<ReturnType<typeof provider.getTransaction>>;
  let receipt: Awaited<ReturnType<typeof provider.getTransactionReceipt>>;

  try {
    [transaction, receipt] = await Promise.all([
      provider.getTransaction(transactionHash),
      provider.getTransactionReceipt(transactionHash),
    ]);
  } catch {
    return { status: 'confirmation_unavailable' };
  }

  // Still pending on the network — not a terminal success or failure.
  if (!transaction || !receipt) {
    return { status: 'not_mined' };
  }

  // Match sender / target / full calldata before trusting receipt status.
  if (transaction.from.toLowerCase() !== account.toLowerCase()) {
    throw createMismatchError('sender');
  }

  if (transaction.to?.toLowerCase() !== expectedCall.target.toLowerCase()) {
    throw createMismatchError('target');
  }

  if (transaction.data.toLowerCase() !== expectedCall.data.toLowerCase()) {
    throw createMismatchError('calldata');
  }

  if (receipt.status === 1) {
    return { status: 'confirmed', source: 'server' };
  }

  if (receipt.status === 0) {
    return { status: 'reverted', source: 'server' };
  }

  // status null/unknown — do not invent a terminal on-chain result.
  return { status: 'confirmation_unavailable' };
}
