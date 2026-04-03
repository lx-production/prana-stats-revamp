import { ethers } from 'ethers';
import type { StakingStatsApiResponse } from '../../types/api.types.ts';
import { asBigInt, formatEther } from '../../utils/pranaStatsUtils.ts';
import { getServerPolygonProvider } from '../utils/providers.ts';
import { loadPranaPricesBundle } from './pranaPrices.ts';
import { MINIMAL_ERC20_ABI, PRANA_ADDRESS } from '../../constants/sharedContracts.ts';
import { INTEREST_CONTRACT_ADDRESS, STAKING_CONTRACT_ABI, STAKING_CONTRACT_ADDRESS } from '../../constants/stakingContracts.ts';

async function safeContractCall(call: Promise<unknown>, fallback: bigint): Promise<bigint> {
  try {
    return asBigInt(await call);
  } catch {
    return fallback;
  }
}

async function loadStakingSnapshot() {
  const provider = await getServerPolygonProvider();
  const tokenContract = new ethers.Contract(PRANA_ADDRESS, MINIMAL_ERC20_ABI, provider);
  const stakingContract = new ethers.Contract(STAKING_CONTRACT_ADDRESS, STAKING_CONTRACT_ABI, provider);

  const [stakedBalance, interestContractBalanceRaw, interestNeeded] = await Promise.all([
    safeContractCall(tokenContract.balanceOf(STAKING_CONTRACT_ADDRESS), 0n),
    safeContractCall(tokenContract.balanceOf(INTEREST_CONTRACT_ADDRESS), 0n),
    safeContractCall(stakingContract.totalInterestNeeded(), 0n),
  ]);

  const stakedPrana = formatEther(stakedBalance) || 1000000;
  const interestContractBalancePrana = formatEther(interestContractBalanceRaw);
  const interestPrana = formatEther(interestNeeded) || 80000;

  return {
    stakedPrana,
    interestContractBalancePrana,
    interestPrana,
  };
}

export async function loadStakingStats(): Promise<StakingStatsApiResponse> {
  const [{ btcPriceVnd, latestSatPrice }, stakingStats] = await Promise.all([
    loadPranaPricesBundle(),
    loadStakingSnapshot(),
  ]);

  const pranaPriceVnd = (latestSatPrice / 1e8) * btcPriceVnd;

  return {
    stakedPrana: stakingStats.stakedPrana,
    stakedVnd: stakingStats.stakedPrana * pranaPriceVnd,
    interestContractBalancePrana: stakingStats.interestContractBalancePrana,
    interestContractBalanceVnd: stakingStats.interestContractBalancePrana * pranaPriceVnd,
    interestPrana: stakingStats.interestPrana,
    interestVnd: stakingStats.interestPrana * pranaPriceVnd,
  };
}
