import { ethers } from 'ethers';
import { getServerPolygonProvider } from '../utils/providers.ts';
import { parseUnsignedDecimalRaw } from '../utils/parseUnsignedDecimalRaw.ts';
import { confirmTransactionOnChain } from '../utils/transactionConfirmationLookup.ts';
import { StakingConfirmationMismatchError } from '../utils/stakingConfirmationUtils.ts';
import { STAKING_CONTRACT_ABI, STAKING_CONTRACT_ADDRESS } from '../../constants/stakingContracts.ts';

import type { Hex } from '../../types/blockchain.types.ts';
import type { ExpectedCall, ConfirmationLookupProvider, ConfirmationMismatchReason } from '../types/transactionConfirmationTypes.ts';
import type { StakingTransactionActionSnapshot, StakingTransactionConfirmation, StakingTransactionConfirmationRequest } from '../../features/staking/staking.types.ts';

const STAKING_IFACE = new ethers.Interface(STAKING_CONTRACT_ABI);

/** Re-export for existing tests that inject a provider double. */
export type StakingConfirmationLookupProvider = ConfirmationLookupProvider;

type StakingConfirmationDependencies = {
  getProvider?: () => Promise<ConfirmationLookupProvider>;
};

const MISMATCH_MESSAGES: Record<ConfirmationMismatchReason, string> = {
  sender: 'Staking transaction sender does not match account.',
  target: 'Staking transaction target does not match expected contract.',
  calldata: 'Staking transaction calldata does not match expected action.',
};

/**
 * Fallback confirmation via server Polygon RPC.
 * Always targets the hardcoded staking contract; never trusts client addresses.
 * RPC skeleton lives in confirmTransactionOnChain; this file maps the action.
 */
export async function confirmStakingTransaction(
  request: StakingTransactionConfirmationRequest,
  dependencies: StakingConfirmationDependencies = {},
): Promise<StakingTransactionConfirmation> {
  const expected = buildExpectedCall(request.action);

  return confirmTransactionOnChain({
    account: request.account,
    expectedCall: expected,
    transactionHash: request.transactionHash,
    getProvider: dependencies.getProvider ?? getServerPolygonProvider,
    createMismatchError: (reason) =>
      new StakingConfirmationMismatchError(MISMATCH_MESSAGES[reason]),
  });
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
