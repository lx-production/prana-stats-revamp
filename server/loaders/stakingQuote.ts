import { ethers } from 'ethers';
import { getServerPolygonProvider } from '../utils/providers.ts';
import { mapDurationOptions } from '../utils/stakingReadUtils.ts';
import { PRANA_ADDRESS } from '../../constants/sharedContracts.ts';
import { parseUnsignedDecimalRaw } from '../utils/stakingQuoteUtils.ts';
import { toBigInt, toNumberSafe } from '../../utils/fetchActiveStakesUtils.ts';
import { computeStakingQuote } from '../../features/staking/utils/stakingFundCheck.ts';
import { INTEREST_CONTRACT_ADDRESS, PRANA_TOKEN_ABI, STAKING_CONTRACT_ABI, STAKING_CONTRACT_ADDRESS } from '../../constants/stakingContracts.ts';

import type { StakingQuote, StakingQuoteRequest } from '../../features/staking/staking.types.ts';

/**
 * Live fully-funded preflight at one blockTag.
 * Soft blockers return 200-shaped quotes with `issues`; RPC failures throw (502).
 */
export async function loadStakingQuote(
  request: StakingQuoteRequest,
): Promise<StakingQuote> {
  const amountRaw = parseUnsignedDecimalRaw(request.amountRaw);
  if (amountRaw === null) {
    throw new Error('Invalid staking quote amount.');
  }

  const provider = await getServerPolygonProvider();
  const block = await provider.getBlock('latest');
  if (!block) {
    throw new Error('Failed to resolve latest block');
  }

  const blockTag = block.number;
  const stakingContract = new ethers.Contract(
    STAKING_CONTRACT_ADDRESS,
    STAKING_CONTRACT_ABI,
    provider,
  );
  const pranaContract = new ethers.Contract(
    PRANA_ADDRESS,
    PRANA_TOKEN_ABI,
    provider,
  );

  // Same block for balance, committed interest, pause, min, and APR table.
  const [paused, minStake, allAprs, interestBalance, totalInterestNeeded] =
    await Promise.all([
      stakingContract.paused({ blockTag }),
      stakingContract.MIN_STAKE({ blockTag }),
      stakingContract.getAllAPRs({ blockTag }),
      pranaContract.balanceOf(INTEREST_CONTRACT_ADDRESS, { blockTag }),
      stakingContract.totalInterestNeeded({ blockTag }),
    ]);

  const [durationsRaw, aprsRaw] = allAprs as [unknown[], unknown[]];
  const durations = mapDurationOptions(durationsRaw, aprsRaw);
  const matched = durations.find(
    (option) => option.seconds === request.durationSeconds,
  );

  const quoted = computeStakingQuote({
    amountRaw,
    durationSeconds: request.durationSeconds,
    apr: matched?.apr ?? null,
    paused: Boolean(paused),
    minStakeRaw: toBigInt(minStake),
    interestBalanceRaw: toBigInt(interestBalance),
    totalInterestNeededRaw: toBigInt(totalInterestNeeded),
  });

  return {
    amountRaw: amountRaw.toString(),
    durationSeconds: request.durationSeconds,
    apr: quoted.apr,
    newStakeInterestRaw: quoted.newStakeInterestRaw.toString(),
    interestBalanceRaw: toBigInt(interestBalance).toString(),
    totalInterestNeededRaw: toBigInt(totalInterestNeeded).toString(),
    availableInterestFundRaw: quoted.availableInterestFundRaw.toString(),
    minStakeRaw: toBigInt(minStake).toString(),
    paused: Boolean(paused),
    blockNumber: block.number,
    blockTimestamp: toNumberSafe(block.timestamp),
    issues: quoted.issues,
  };
}
