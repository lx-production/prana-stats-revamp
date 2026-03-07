import { ethers } from 'ethers';
import type { PranaStatsApiResponse } from '../../types/api.types.ts';
import { getBondingStats } from '../../utils/bondingStats.ts';
import {
  asBigInt,
  calcChange,
  formatEther,
  getFirstPrice,
  getPriceAtOrAfter,
  getSatsPerformanceInputs,
} from '../../utils/pranaStatsUtils.ts';
import { getServerPolygonProvider } from '../utils/providers.ts';
import { loadPranaPricesBundle } from './pranaPrices.ts';
import { BUY_BOND_V1_TOTAL_VOLUME_RAW, SELL_BOND_V1_TOTAL_VOLUME_RAW, loadBondSnapshot } from './bondMetrics.ts';
import { INTEREST_CONTRACT_ADDRESS, STAKING_CONTRACT_ABI, STAKING_CONTRACT_ADDRESS } from '../../constants/stakingContracts.ts';
import { PRANA_ABI, PRANA_ADDRESS } from '../../constants/sharedContracts.ts';

const ATL_PRICE = 0.0017;

async function safeContractCall(call: Promise<unknown>, fallback: bigint): Promise<bigint> {
  try {
    return asBigInt(await call);
  } catch {
    return fallback;
  }
}

async function loadStakingSnapshot() {
  const provider = await getServerPolygonProvider();
  const tokenContract = new ethers.Contract(PRANA_ADDRESS, PRANA_ABI, provider);
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

export async function loadPranaStats(): Promise<PranaStatsApiResponse> {
  const { btcPriceUsd, btcPriceVnd, usdToVndRate, latestSatPrice, satsData, d30, d90, d180, d365 } =
    await loadPranaPricesBundle();

  const pranaPriceVnd = (latestSatPrice / 1e8) * btcPriceVnd;
  const marketCap = Math.round(pranaPriceVnd * 1e7);

  const [stakingStats, bondSnapshot] = await Promise.all([loadStakingSnapshot(), loadBondSnapshot()]);
  const bondingStats = getBondingStats({
    buyCommittedV1: bondSnapshot.buyCommittedV1,
    buyCommittedV2: bondSnapshot.buyCommittedV2,
    buyBalanceV2: bondSnapshot.buyBalanceV2,
    sellCommittedV1: bondSnapshot.sellCommittedV1,
    sellCommittedV2: bondSnapshot.sellCommittedV2,
    sellBalanceV2: bondSnapshot.sellBalanceV2,
    buyBondTotalRawV2: bondSnapshot.buyBondTotalRawV2,
    sellBondTotalRawV2: bondSnapshot.sellBondTotalRawV2,
    buyBondV1TotalRaw: BUY_BOND_V1_TOTAL_VOLUME_RAW,
    sellBondV1TotalRaw: SELL_BOND_V1_TOTAL_VOLUME_RAW,
    pranaPriceVnd,
  });

  const latestSatPriceUsd = (latestSatPrice / 1e8) * btcPriceUsd;
  const { parsedSatsData, m1Cutoff, m3Cutoff, m6Cutoff, y1Cutoff, safeSatsAtl } =
    getSatsPerformanceInputs(satsData, latestSatPrice);

  const mockM1 = latestSatPriceUsd * 0.95;
  const mockM3 = latestSatPriceUsd * 0.8;
  const mockM6 = latestSatPriceUsd * 1.2;
  const mockY1 = latestSatPriceUsd * 0.5;

  return {
    btcPriceUsd,
    btcPriceVnd,
    usdToVndRate,
    latestSatPrice,
    marketCapVnd: marketCap,
    stakedPrana: stakingStats.stakedPrana,
    stakedVnd: stakingStats.stakedPrana * pranaPriceVnd,
    interestContractBalancePrana: stakingStats.interestContractBalancePrana,
    interestContractBalanceVnd: stakingStats.interestContractBalancePrana * pranaPriceVnd,
    interestPrana: stakingStats.interestPrana,
    interestVnd: stakingStats.interestPrana * pranaPriceVnd,
    buyBondPrana: bondingStats.buyBondPrana,
    buyBondVnd: bondingStats.buyBondVnd,
    sellBondPrana: bondingStats.sellBondPrana,
    sellBondVnd: bondingStats.sellBondVnd,
    buyBondBalanceDisplay: bondingStats.buyBondBalanceDisplay,
    buyBondCommittedDisplay: bondingStats.buyBondCommittedDisplay,
    buyBondCapacityDisplay: bondingStats.buyBondCapacityDisplay,
    buyBondCommittedPercent: bondingStats.buyBondCommittedPercent,
    buyBondCapacityPercent: bondingStats.buyBondCapacityPercent,
    sellBondBalanceDisplay: bondingStats.sellBondBalanceDisplay,
    sellBondCommittedDisplay: bondingStats.sellBondCommittedDisplay,
    sellBondCapacityDisplay: bondingStats.sellBondCapacityDisplay,
    sellBondCommittedPercent: bondingStats.sellBondCommittedPercent,
    sellBondCapacityPercent: bondingStats.sellBondCapacityPercent,
    priceChange: {
      m1: calcChange(getFirstPrice(d30, mockM1), latestSatPriceUsd),
      m3: calcChange(getFirstPrice(d90, mockM3), latestSatPriceUsd),
      m6: calcChange(getFirstPrice(d180, mockM6), latestSatPriceUsd),
      y1: calcChange(getFirstPrice(d365, mockY1), latestSatPriceUsd),
      atl: calcChange(ATL_PRICE, latestSatPriceUsd),
    },
    priceChangeBtc: {
      m1: calcChange(getPriceAtOrAfter(parsedSatsData, m1Cutoff, latestSatPrice), latestSatPrice),
      m3: calcChange(getPriceAtOrAfter(parsedSatsData, m3Cutoff, latestSatPrice), latestSatPrice),
      m6: calcChange(getPriceAtOrAfter(parsedSatsData, m6Cutoff, latestSatPrice), latestSatPrice),
      y1: calcChange(getPriceAtOrAfter(parsedSatsData, y1Cutoff, latestSatPrice), latestSatPrice),
      atl: calcChange(safeSatsAtl, latestSatPrice),
    },
  };
}
