import { ethers } from 'ethers';
import { getServerPolygonProvider } from '../utils/providers.ts';
import {
  STAKING_CONTRACT_ABI,
  STAKING_CONTRACT_ADDRESS,
} from '../../constants/stakingContracts.ts';
import {
  StakingConfirmationMismatchError,
} from '../utils/stakingConfirmationUtils.ts';
import { parseUnsignedDecimalRaw } from '../utils/parseUnsignedDecimalRaw.ts';

import type { Address, Hex } from '../../types/blockchain.types.ts';
import type {
  StakingTransactionActionSnapshot,
  StakingTransactionConfirmation,
  StakingTransactionConfirmationRequest,
} from '../../features/staking/staking.types.ts';

const STAKING_IFACE = new ethers.Interface(STAKING_CONTRACT_ABI);

/** Minimal RPC surface — real provider or a test double. */
export type StakingConfirmationLookupProvider = {
  getTransaction(hash: string): Promise<{
    from: string;
    to?: string | null;
    data: string;
    chainId?: number | bigint | null;
  } | null>;
  getTransactionReceipt(hash: string): Promise<{
    status: number | null;
  } | null>;
};

type StakingConfirmationDependencies = {
  getProvider?: () => Promise<StakingConfirmationLookupProvider>;
};

type ExpectedCall = {
  target: Address;
  data: Hex;
};

/**
 * Fallback confirmation via server Polygon RPC.
 * Always targets the hardcoded staking contract; never trusts client addresses.
 * RPC read failures become confirmation_unavailable (not reverted).
 */
export async function confirmStakingTransaction(
  request: StakingTransactionConfirmationRequest,
  dependencies: StakingConfirmationDependencies = {},
): Promise<StakingTransactionConfirmation> {
  const expected = buildExpectedCall(request.action);
  const loadProvider = dependencies.getProvider ?? getServerPolygonProvider;

  let provider: StakingConfirmationLookupProvider;
  try {
    provider = await loadProvider();
  } catch {
    return { status: 'confirmation_unavailable' };
  }

  let transaction: Awaited<
    ReturnType<StakingConfirmationLookupProvider['getTransaction']>
  >;
  let receipt: Awaited<
    ReturnType<StakingConfirmationLookupProvider['getTransactionReceipt']>
  >;

  try {
    [transaction, receipt] = await Promise.all([
      provider.getTransaction(request.transactionHash),
      provider.getTransactionReceipt(request.transactionHash),
    ]);
  } catch {
    return { status: 'confirmation_unavailable' };
  }

  if (!transaction || !receipt) {
    return { status: 'not_mined' };
  }

  // Match sender / target / full calldata before trusting receipt status.
  if (transaction.from.toLowerCase() !== request.account.toLowerCase()) {
    throw new StakingConfirmationMismatchError(
      'Staking transaction sender does not match account.',
    );
  }

  if (transaction.to?.toLowerCase() !== expected.target.toLowerCase()) {
    throw new StakingConfirmationMismatchError(
      'Staking transaction target does not match expected contract.',
    );
  }

  if (transaction.data.toLowerCase() !== expected.data.toLowerCase()) {
    throw new StakingConfirmationMismatchError(
      'Staking transaction calldata does not match expected action.',
    );
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

/** Resolve fixed target + calldata from the action snapshot (internal mapping only). */
export function buildExpectedCall(
  action: StakingTransactionActionSnapshot,
): ExpectedCall {
  const target = STAKING_CONTRACT_ADDRESS;

  if (action.kind === 'stake') {
    const amount = parseUnsignedDecimalRaw(action.amountRaw);
    if (amount === null || amount === 0n) {
      throw new StakingConfirmationMismatchError('Invalid stake amount.');
    }
    return {
      target,
      data: STAKING_IFACE.encodeFunctionData('stakeWithPermit', [
        amount,
        BigInt(action.durationSeconds),
        BigInt(action.deadline),
        action.v,
        action.r,
        action.s,
      ]) as Hex,
    };
  }

  const functionName =
    action.kind === 'claim'
      ? 'claimInterest'
      : action.kind === 'unstake'
        ? 'unstake'
        : 'unstakeEarly';

  return {
    target,
    data: STAKING_IFACE.encodeFunctionData(functionName, [
      action.stakeId,
    ]) as Hex,
  };
}
