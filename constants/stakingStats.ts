import type { StakingStatsData } from '../types';

export const initialStakingStats: StakingStatsData = {
  stakedPrana: null,
  stakedVnd: null,
  interestContractBalancePrana: null,
  interestContractBalanceVnd: null,
  interestPrana: null,
  interestVnd: null,
  claimableUnclaimedInterestPrana: null,
  dailyInterestPrana: null,
  runwayDays: null,
  isLoading: true,
  error: null,
};
