import type { StakingStatsApiResponse } from '../../types/api.types.ts';
import type { ActiveStakesResult } from '../../types/activeStakes.types.ts';
import { ethers } from 'ethers';
import { loadPranaPricesBundle } from './pranaPrices.ts';
import { getServerPolygonProvider } from '../utils/providers.ts';
import { formatPranaFloatFromRaw } from '../../utils/formatters.ts';
import { asBigInt } from '../../utils/pranaStatsUtils.ts';
import { MINIMAL_ERC20_ABI, PRANA_ADDRESS } from '../../constants/sharedContracts.ts';
import { calculateDailyInterestPrana, loadActiveStakesSnapshot } from './activeStakes.ts';
import { INTEREST_CONTRACT_ADDRESS, STAKING_CONTRACT_ABI, STAKING_CONTRACT_ADDRESS } from '../../constants/stakingContracts.ts';

async function safeContractCall(call: Promise<unknown>, fallback: bigint): Promise<bigint> {
  try {
    return asBigInt(await call);
  } catch {
    return fallback;
  }
}

function getLatestMatureTime(activeStakesSnapshot: ActiveStakesResult | null): number | null {
  const fromSnapshot = activeStakesSnapshot?.interest?.latestMatureTime;
  if (fromSnapshot) {
    const timestamp = Number.parseFloat(fromSnapshot);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  const latest = activeStakesSnapshot?.activeStakes.reduce<number | null>((max, stake) => {
    const matureTime = Number.parseFloat(stake.matureTime);
    if (!Number.isFinite(matureTime)) return max;
    return max === null || matureTime > max ? matureTime : max;
  }, null);

  return latest ?? null;
}

async function loadStakingSnapshot() {
  const provider = await getServerPolygonProvider();
  const tokenContract = new ethers.Contract(PRANA_ADDRESS, MINIMAL_ERC20_ABI, provider);
  const stakingContract = new ethers.Contract(STAKING_CONTRACT_ADDRESS, STAKING_CONTRACT_ABI, provider);

  const [stakedBalance, interestContractBalanceRaw, interestNeeded, activeStakesSnapshot] = await Promise.all([
    safeContractCall(tokenContract.balanceOf(STAKING_CONTRACT_ADDRESS), 0n),
    safeContractCall(tokenContract.balanceOf(INTEREST_CONTRACT_ADDRESS), 0n),
    safeContractCall(stakingContract.totalInterestNeeded(), 0n),
    loadActiveStakesSnapshot().catch(() => null),
  ]);

  const stakedPrana = formatPranaFloatFromRaw(stakedBalance) || 1000000;
  const interestContractBalancePrana = formatPranaFloatFromRaw(interestContractBalanceRaw);
  const interestPrana = formatPranaFloatFromRaw(interestNeeded) || 80000;
  const dailyInterestPrana = activeStakesSnapshot
    ? activeStakesSnapshot.interest?.dailyInterestPrana
      ?? calculateDailyInterestPrana(activeStakesSnapshot.activeStakes)
    : 0;
  const claimableUnclaimedInterestPrana =
    activeStakesSnapshot?.interest?.claimableUnclaimedInterestPrana ?? 0;
  const surplusPrana = interestContractBalancePrana - interestPrana;
  const surplusDays = dailyInterestPrana > 0 && surplusPrana > 0
    ? surplusPrana / dailyInterestPrana
    : null;
  const latestMatureTime = getLatestMatureTime(activeStakesSnapshot);
  const snapshotBlockTimestamp =
    activeStakesSnapshot?.chain.blockTimestamp ?? Math.floor(Date.now() / 1000);
  const daysUntilLatestMaturity = latestMatureTime
    ? Math.max((latestMatureTime - snapshotBlockTimestamp) / 86_400, 0)
    : null;
  const surplusRunwayRemainingDays = surplusDays !== null && daysUntilLatestMaturity !== null
    ? daysUntilLatestMaturity + surplusDays
    : null;

  return {
    stakedPrana,
    interestContractBalancePrana,
    interestPrana,
    claimableUnclaimedInterestPrana,
    dailyInterestPrana,
    surplusRunwayRemainingDays,
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
    claimableUnclaimedInterestPrana: stakingStats.claimableUnclaimedInterestPrana,
    dailyInterestPrana: stakingStats.dailyInterestPrana,
    surplusRunwayRemainingDays: stakingStats.surplusRunwayRemainingDays,
  };
}
