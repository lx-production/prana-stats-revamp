import { ethers } from 'ethers';
import { erc20Abi } from 'viem';
import { loadPranaPricesBundle } from './pranaPrices.ts';
import { asBigInt } from '../../utils/pranaStatsUtils.ts';
import { SECONDS_PER_DAY } from '../../constants/network.ts';
import { getServerPolygonProvider } from '../utils/providers.ts';
import { formatPranaFloatFromRaw } from '../../utils/formatters.ts';
import { PRANA_ADDRESS } from '../../constants/sharedContracts.ts';
import { calculateDailyInterestPrana, loadActiveStakesSnapshot } from './activeStakes.ts';
import { INTEREST_CONTRACT_ADDRESS, STAKING_CONTRACT_ABI, STAKING_CONTRACT_ADDRESS } from '../../constants/stakingContracts.ts';

import type { StakingStatsApiResponse } from '../../types/api.types.ts';
import type { ActiveStakesResult } from '../../types/activeStakes.types.ts';

/**
 * Wraps a contract call so a single RPC failure does not break the whole loader.
 * On error, returns the given fallback bigint instead of throwing.
 */
async function safeContractCall(call: Promise<unknown>, fallback: bigint): Promise<bigint> {
  try {
    return asBigInt(await call);
  } catch {
    return fallback;
  }
}

/**
 * Finds the farthest maturity timestamp among active stakes (unix seconds).
 *
 * Prefers `interest.latestMatureTime` from the snapshot when present;
 * otherwise scans each stake's `matureTime` and takes the max.
 * Returns null if there is no usable snapshot / maturity data.
 */
function getLatestMatureTime(activeStakesSnapshot: ActiveStakesResult | null): number | null {
  // Prefer the precomputed aggregate from the active-stakes snapshot.
  const fromSnapshot = activeStakesSnapshot?.interest?.latestMatureTime;
  if (fromSnapshot) {
    const timestamp = Number.parseFloat(fromSnapshot);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  // Fallback: walk every active stake and keep the latest matureTime.
  const latest = activeStakesSnapshot?.activeStakes.reduce<number | null>((max, stake) => {
    const matureTime = Number.parseFloat(stake.matureTime);
    if (!Number.isFinite(matureTime)) return max;
    return max === null || matureTime > max ? matureTime : max;
  }, null);

  return latest ?? null;
}

/**
 * Reads on-chain staking balances + interest obligations, then combines them
 * with the active-stakes snapshot to compute surplus / runway metrics.
 *
 * Parallel RPCs:
 * - PRANA held by the staking contract  → total staked
 * - PRANA held by the interest contract → interest pool balance
 * - stakingContract.totalInterestNeeded → how much interest is still owed
 * - active stakes snapshot              → daily interest + claimable amounts
 */
async function loadStakingSnapshot() {
  const provider = await getServerPolygonProvider();
  const tokenContract = new ethers.Contract(PRANA_ADDRESS, erc20Abi, provider);
  const stakingContract = new ethers.Contract(STAKING_CONTRACT_ADDRESS, STAKING_CONTRACT_ABI, provider);

  const [stakedBalance, interestContractBalanceRaw, interestNeeded, activeStakesSnapshot] = await Promise.all([
    safeContractCall(tokenContract.balanceOf(STAKING_CONTRACT_ADDRESS), 0n),
    safeContractCall(tokenContract.balanceOf(INTEREST_CONTRACT_ADDRESS), 0n),
    safeContractCall(stakingContract.totalInterestNeeded(), 0n),
    // Soft-fail: missing/stale snapshot still lets on-chain balances load.
    loadActiveStakesSnapshot().catch(() => null),
  ]);

  // Hardcoded fallbacks match historical defaults when RPC returns empty/zero.
  const stakedPrana = formatPranaFloatFromRaw(stakedBalance) || 1000000;
  const interestContractBalancePrana = formatPranaFloatFromRaw(interestContractBalanceRaw);
  const interestPrana = formatPranaFloatFromRaw(interestNeeded) || 80000;

  // Daily interest owed to stakers; recompute from stake list if snapshot lacks it.
  const dailyInterestPrana = activeStakesSnapshot
    ? activeStakesSnapshot.interest?.dailyInterestPrana
      ?? calculateDailyInterestPrana(activeStakesSnapshot.activeStakes)
    : 0;

  // Interest that matured stakes can still claim (not yet withdrawn).
  const claimableUnclaimedInterestPrana =
    activeStakesSnapshot?.interest?.claimableUnclaimedInterestPrana ?? 0;

  // Surplus = interest pool minus total interest still owed to stakers.
  const surplusPrana = interestContractBalancePrana - interestPrana;

  // How many days the surplus lasts at the current daily interest burn rate.
  const surplusDays = dailyInterestPrana > 0 && surplusPrana > 0
    ? surplusPrana / dailyInterestPrana
    : null;

  const latestMatureTime = getLatestMatureTime(activeStakesSnapshot);
  // Prefer chain block time from the snapshot; else use wall-clock "now".
  const snapshotBlockTimestamp =
    activeStakesSnapshot?.chain.blockTimestamp ?? Math.floor(Date.now() / 1000);

  // Days left until the farthest stake matures (floored at 0 if already past).
  const daysUntilLatestMaturity = latestMatureTime
    ? Math.max((latestMatureTime - snapshotBlockTimestamp) / SECONDS_PER_DAY, 0)
    : null;

  // Runway = days until last maturity + extra days surplus can cover after that.
  // null when we lack surplus days or maturity timing.
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

/**
 * Public loader for `/api/staking-stats`.
 *
 * Loads price data and the staking snapshot in parallel, converts PRANA
 * amounts to VND using sat price × BTC/VND, then returns the API payload.
 */
export async function loadStakingStats(): Promise<StakingStatsApiResponse> {
  const [{ btcPriceVnd, latestSatPrice }, stakingStats] = await Promise.all([
    loadPranaPricesBundle(),
    loadStakingSnapshot(),
  ]);

  // 1 PRANA = (sats per PRANA) / 1e8 BTC, then × BTC price in VND.
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
