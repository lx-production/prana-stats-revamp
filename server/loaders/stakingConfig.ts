import { ethers } from 'ethers';
import { getServerPolygonProvider } from '../utils/providers.ts';
import { POLYGON_CHAIN_ID } from '../../constants/network.ts';
import { PRANA_ADDRESS } from '../../constants/sharedContracts.ts';
import { mapDurationOptions } from '../utils/stakingReadUtils.ts';
import { toBigInt, toNumberSafe } from '../../utils/fetchActiveStakesUtils.ts';
import {
  INTEREST_CONTRACT_ADDRESS,
  PRANA_PERMIT_DOMAIN_NAME,
  PRANA_PERMIT_DOMAIN_VERSION,
  STAKING_CONTRACT_ABI,
  STAKING_CONTRACT_ADDRESS,
} from '../../constants/stakingContracts.ts';

import type { StakingConfig } from '../../features/staking/staking.types.ts';

/**
 * Live chain read of staking protocol config at a single block.
 * Hard-fails on RPC/contract errors so the route can return 502.
 */
export async function loadStakingConfig(): Promise<StakingConfig> {
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

  const [paused, minStake, gracePeriod, earlyUnstakePenaltyPercent, allAprs] = await Promise.all([
    stakingContract.paused({ blockTag }),
    stakingContract.MIN_STAKE({ blockTag }),
    stakingContract.gracePeriod({ blockTag }),
    stakingContract.earlyUnstakePenaltyPercent({ blockTag }),
    stakingContract.getAllAPRs({ blockTag }),
  ]);

  const [durationsRaw, aprsRaw] = allAprs as [unknown[], unknown[]];

  return {
    chainId: POLYGON_CHAIN_ID,
    blockNumber: block.number,
    blockTimestamp: block.timestamp,
    paused: Boolean(paused),
    minStakeRaw: toBigInt(minStake).toString(),
    gracePeriodSeconds: toNumberSafe(gracePeriod),
    earlyUnstakePenaltyPercent: toNumberSafe(earlyUnstakePenaltyPercent),
    durations: mapDurationOptions(durationsRaw, aprsRaw),
    contracts: {
      prana: PRANA_ADDRESS,
      staking: STAKING_CONTRACT_ADDRESS,
      interest: INTEREST_CONTRACT_ADDRESS,
    },
    permitDomain: {
      name: PRANA_PERMIT_DOMAIN_NAME,
      version: PRANA_PERMIT_DOMAIN_VERSION,
    },
  };
}
