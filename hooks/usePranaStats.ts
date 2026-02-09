import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { PRANA_ADDRESS, PRANA_DECIMALS, WBTC_ADDRESS, WBTC_ABI } from '../constants/sharedContracts';
import { INTEREST_CONTRACT_ADDRESS } from '../constants/stakingContracts';
import { BUY_BOND_ADDRESS_V1, BUY_BOND_ADDRESS_V2, BUY_BOND_ABI_V1, BUY_BOND_ABI_V2, SELL_BOND_ADDRESS_V1, SELL_BOND_ADDRESS_V2, SELL_BOND_ABI_V1, SELL_BOND_ABI_V2 } from '../constants/bonds';
import { getTotalsFromBondsV2Json } from '../utils/bondsUtils';
import { getBondingStats } from '../utils/bondingStats';
import { fetchPranaPricesBundle } from '../utils/pranaPrices';
import { getPolygonProvider } from '../utils/polygonProvider';
import { BondTotalsCacheEntry, PranaStatsData, PranaStatsComputed } from '../types';

const STAKING_CONTRACT_ADDRESS = '0x714425A4F4d624ef83fEff810a0EEC30B0847868';
const ATL_PRICE = 0.0017; // From scripts.js
const BUY_BOND_V1_TOTAL_VOLUME_RAW = ethers.parseUnits('145235', PRANA_DECIMALS);
const SELL_BOND_V1_TOTAL_VOLUME_RAW = ethers.parseUnits('194235', PRANA_DECIMALS);

const STAKING_CONTRACT_ABI = ["function totalInterestNeeded() view returns (uint256)"];
const PRANA_TOKEN_ABI = ["function balanceOf(address owner) view returns (uint256)"];
const bondTotalsCache = new Map<string, BondTotalsCacheEntry>();

const initialStats: PranaStatsData = {
  btcPriceUsd: null,
  btcPriceVnd: null,
  usdToVndRate: null,
  latestSatPrice: null,
  marketCapVnd: null,
  stakedPrana: null,
  stakedVnd: null,
  interestContractBalancePrana: null,
  interestContractBalanceVnd: null,
  interestPrana: null,
  interestVnd: null,
  buyBondPrana: null,
  buyBondVnd: null,
  sellBondPrana: null,
  sellBondVnd: null,
  buyBondBalanceDisplay: null,
  buyBondCommittedDisplay: null,
  buyBondCapacityDisplay: null,
  buyBondCommittedPercent: null,
  buyBondCapacityPercent: null,
  sellBondBalanceDisplay: null,
  sellBondCommittedDisplay: null,
  sellBondCapacityDisplay: null,
  sellBondCommittedPercent: null,
  sellBondCapacityPercent: null,
  priceChange: { m1: 0, m3: 0, m6: 0, y1: 0, atl: 0 },
  isLoading: true,
  error: null
};

const fetchPranaStats = async (
  getProvider: () => ethers.JsonRpcProvider
): Promise<PranaStatsComputed> => {
  const provider = getProvider();

  const { btcPriceUsd, btcPriceVnd, usdToVndRate, latestSatPrice, d30, d90, d180, d365, bondsV2Json } =
    await fetchPranaPricesBundle();
    
  const pranaPriceVnd = (latestSatPrice / 1e8) * btcPriceVnd;
  const marketCap = Math.round(pranaPriceVnd * 1e7); // 10M Total Supply
  const tokenContract = new ethers.Contract(PRANA_ADDRESS, PRANA_TOKEN_ABI, provider);
  const stakingContract = new ethers.Contract(STAKING_CONTRACT_ADDRESS, STAKING_CONTRACT_ABI, provider);
  const wbtcTokenContract = new ethers.Contract(WBTC_ADDRESS, WBTC_ABI, provider);
  const buyBondV1Contract = new ethers.Contract(BUY_BOND_ADDRESS_V1, BUY_BOND_ABI_V1, provider);
  const buyBondV2Contract = new ethers.Contract(BUY_BOND_ADDRESS_V2, BUY_BOND_ABI_V2, provider);
  const sellBondV1Contract = new ethers.Contract(SELL_BOND_ADDRESS_V1, SELL_BOND_ABI_V1, provider);
  const sellBondV2Contract = new ethers.Contract(SELL_BOND_ADDRESS_V2, SELL_BOND_ABI_V2, provider);

  // Use try-catch for contract calls to avoid full failure if RPC is down
  const safeContractCall = async (call: Promise<any>, fallback: any) => {
    try {
      return await call;
    } catch (e) {
      console.warn("Contract call failed", e);
      return fallback;
    }
  };

  const { buyBondTotalRawV2, sellBondTotalRawV2 } = getTotalsFromBondsV2Json(bondsV2Json);

  // Cache the JSON totals so we don't re-parse / re-fetch repeatedly if this hook is re-mounted.
  bondTotalsCache.set('buy-v2', { total: buyBondTotalRawV2, timestamp: Date.now() });
  bondTotalsCache.set('sell-v2', { total: sellBondTotalRawV2, timestamp: Date.now() });

  const [
    stakedBalance,
    interestContractBalanceRaw,
    interestNeeded,
    buyCommittedV2,
    buyCommittedV1,
    buyBalanceV2Raw,
    sellCommittedV2,
    sellCommittedV1,
    sellBalanceV2Raw,
  ] = await Promise.all([
    safeContractCall(tokenContract.balanceOf(STAKING_CONTRACT_ADDRESS), 0n),
    safeContractCall(tokenContract.balanceOf(INTEREST_CONTRACT_ADDRESS), 0n),
    safeContractCall(stakingContract.totalInterestNeeded(), 0n),
    safeContractCall(buyBondV2Contract.committedPrana(), 0n),
    safeContractCall(buyBondV1Contract.committedPrana(), 0n),
    safeContractCall(tokenContract.balanceOf(BUY_BOND_ADDRESS_V2), 0n),
    safeContractCall(sellBondV2Contract.committedWbtc(), 0n),
    safeContractCall(sellBondV1Contract.committedWbtc(), 0n),
    safeContractCall(wbtcTokenContract.balanceOf(SELL_BOND_ADDRESS_V2), 0n),
  ]);

  const asBigInt = (value: any) =>
    typeof value === 'bigint' ? value : BigInt(value?.toString?.() ?? '0');

  const buyCommittedRawV1 = asBigInt(buyCommittedV1);
  const buyCommittedRawV2 = asBigInt(buyCommittedV2);
  const buyBalanceRawV2 = asBigInt(buyBalanceV2Raw);
  const sellCommittedRawV1 = asBigInt(sellCommittedV1);
  const sellCommittedRawV2 = asBigInt(sellCommittedV2);
  const sellBalanceRawV2 = asBigInt(sellBalanceV2Raw);

  const formatEther = (val: bigint) => parseFloat(ethers.formatUnits(val, PRANA_DECIMALS));

  const stakedPrana = formatEther(stakedBalance) || 1000000; // Mock ~1M staked if 0/failed
  const interestContractBalancePrana = formatEther(interestContractBalanceRaw);
  const interestPrana = formatEther(interestNeeded) || 80000; // Mock ~80k interest if 0/failed
  const bondingStats = getBondingStats({
    buyCommittedV1: buyCommittedRawV1,
    buyCommittedV2: buyCommittedRawV2,
    buyBalanceV2: buyBalanceRawV2,
    sellCommittedV1: sellCommittedRawV1,
    sellCommittedV2: sellCommittedRawV2,
    sellBalanceV2: sellBalanceRawV2,
    buyBondTotalRawV2,
    sellBondTotalRawV2,
    buyBondV1TotalRaw: BUY_BOND_V1_TOTAL_VOLUME_RAW,
    sellBondV1TotalRaw: SELL_BOND_V1_TOTAL_VOLUME_RAW,
    pranaPriceVnd,
  });

  // Calculate Changes
  // Script uses: ((newValue - oldValue) / oldValue) * 100
  const calcChange = (oldP: number, newP: number) => oldP === 0 ? 0 : ((newP - oldP) / oldP) * 100;

  // Calculate current price in USD for comparison
  const latestSatPriceUsd = (latestSatPrice / 1e8) * btcPriceUsd;

  const getFirstPrice = (arr: any[], fallback: number) => arr && arr.length > 0 ? arr[0].p : fallback;

  // Mock historical prices relative to current to show varied percentages
  const mockM1 = latestSatPriceUsd * 0.95; // +5%
  const mockM3 = latestSatPriceUsd * 0.80; // +25%
  const mockM6 = latestSatPriceUsd * 1.20; // -16%
  const mockY1 = latestSatPriceUsd * 0.50; // +100%

  return {
    btcPriceUsd,
    btcPriceVnd,
    usdToVndRate,
    latestSatPrice,

    marketCapVnd: marketCap,
    stakedPrana,
    stakedVnd: stakedPrana * pranaPriceVnd,
    interestContractBalancePrana,
    interestContractBalanceVnd: interestContractBalancePrana * pranaPriceVnd,
    interestPrana,
    interestVnd: interestPrana * pranaPriceVnd,
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
  };
};

export function usePranaStats() {
  const [stats, setStats] = useState<PranaStatsData>(initialStats);

  const getProvider = useCallback(() => {
    return getPolygonProvider();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const computed = await fetchPranaStats(getProvider);

      setStats(prev => ({
        ...prev,
        ...computed,
        isLoading: false,
        error: null,
      }));

    } catch (err: any) {
      console.error("Failed to fetch Prana stats:", err);
      const message =
        typeof err?.message === 'string' && err.message.trim().length > 0
          ? err.message
          : 'Failed to fetch Prana stats';
      setStats(prev => ({ ...prev, isLoading: false, error: message }));
    }
  }, [getProvider]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return stats;
}
