import type { BigNumberish } from 'ethers';

export interface StakeData {
  id?: BigNumberish;
  amount?: BigNumberish;
  startTime?: BigNumberish;
  duration?: BigNumberish;
  apr?: BigNumberish;
  lastClaimTime?: BigNumberish;
}

export interface ActiveStake {
  stakeId: number;
  staker: string;
  amountRaw: string;
  amountPrana: string;
  startTime: string;
  startTimeIso: string;
  startTimeLocal: string;
  durationSeconds: string;
  durationDays: number;
  apr: number;
  lastClaimTime: string;
  matureTime: string;
  matureTimeIso: string;
  matureTimeLocal: string;
  remainingSeconds: string;
}

export interface ActiveStakesResult {
  generatedAt: string;
  rpcUrl: string;
  contract: {
    address: string;
  };
  chain: {
    blockNumber: number | null;
    blockTimestamp: number;
  };
  scan: {
    lastStakeId: number;
    stakersCount: number;
    totalStakesSeen: number;
    activeStakesCount: number;
    claimableStakesCount?: number;
  };
  interest?: {
    dailyInterestPrana: number;
    claimableUnclaimedInterestPrana: number;
  };
  activeStakes: ActiveStake[];
}
