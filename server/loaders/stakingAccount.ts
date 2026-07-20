import { ethers } from 'ethers';
import { getServerPolygonProvider } from '../utils/providers.ts';
import { mapStakeRecords } from '../utils/stakingReadUtils.ts';
import { toBigInt } from '../../utils/fetchActiveStakesUtils.ts';
import { PRANA_ADDRESS, PRANA_TOKEN_ABI } from '../../constants/sharedContracts.ts';
import { STAKING_CONTRACT_ABI, STAKING_CONTRACT_ADDRESS } from '../../constants/stakingContracts.ts';

import type { Address } from '../../types/blockchain.types.ts';
import type { StakingAccountSnapshot } from '../../features/staking/staking.types.ts';

/**
 * Live chain read of one wallet's PRANA balance, permit nonce, and stakes.
 * All contract calls use the same blockTag for a consistent snapshot.
 */
export async function loadStakingAccount(address: Address): Promise<StakingAccountSnapshot> {
  const provider = await getServerPolygonProvider();
  const block = await provider.getBlock('latest');
  if (!block) {
    throw new Error('Failed to resolve latest block');
  }

  const blockTag = block.number;
  const tokenContract = new ethers.Contract(PRANA_ADDRESS, PRANA_TOKEN_ABI, provider);
  const stakingContract = new ethers.Contract(
    STAKING_CONTRACT_ADDRESS,
    STAKING_CONTRACT_ABI,
    provider,
  );

  const [balance, permitNonce, rawStakes] = await Promise.all([
    tokenContract.balanceOf(address, { blockTag }),
    tokenContract.nonces(address, { blockTag }),
    stakingContract.getStakerStakes(address, { blockTag }),
  ]);

  return {
    address,
    blockNumber: block.number,
    blockTimestamp: block.timestamp,
    balanceRaw: toBigInt(balance).toString(),
    permitNonce: toBigInt(permitNonce).toString(),
    stakes: mapStakeRecords(rawStakes as unknown[]),
  };
}
