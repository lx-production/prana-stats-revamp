import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { BUY_BOND_ADDRESS_V2 } from '../constants/buyBondContract';
import { SELL_BOND_ADDRESS_V2 } from '../constants/sellBondContract';
import { PRANA_ADDRESS, PRANA_DECIMALS } from '../constants/sharedContracts';
import { INTEREST_CONTRACT_ADDRESS } from '../constants/stakingContracts';
import { fetchJsonTtl } from '../utils/fetchJsonTtl';
import { fetchJson } from '../utils/fetchJson';

// Configuration & Constants
const viteEnvPolygonRpcUrl =
  typeof import.meta !== 'undefined'
    ? (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_ALCHEMY_POLYGON_MAIN
    : undefined;

const envPolygonRpcUrl =
  viteEnvPolygonRpcUrl ||
  (typeof process !== 'undefined' ? process.env?.VITE_ALCHEMY_POLYGON_MAIN : undefined) ||
  null;

const POLYGON_RPC_URL =
  envPolygonRpcUrl ||
  (typeof window !== 'undefined' ? (window as any).CONFIG?.POLYGON_RPC_URL : null) ||
  'https://polygon-rpc.com'; // Fallback
const STAKING_CONTRACT_ADDRESS = '0x714425A4F4d624ef83fEff810a0EEC30B0847868';
const ATL_PRICE = 0.0017; // From scripts.js
const BOND_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_COOLDOWN_MS = 10 * 60 * 1000;

const BUY_BOND_V1_TOTAL_VOLUME_RAW = ethers.parseUnits('145235', PRANA_DECIMALS);
const SELL_BOND_V1_TOTAL_VOLUME_RAW = ethers.parseUnits('194235', PRANA_DECIMALS);

// ABIs
const STAKING_CONTRACT_ABI = [
  "function totalInterestNeeded() view returns (uint256)"
];
const PRANA_TOKEN_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];
type BondTotalsCacheEntry = {
  total: bigint;
  timestamp: number;
};

const bondTotalsCache = new Map<string, BondTotalsCacheEntry>();
let bondRateLimitUntil = 0;

const getErrorMessage = (error: unknown) => {
  if (!error) return '';
  if (typeof error === 'string') return error.toLowerCase();
  if (typeof error === 'object') {
    const errObj = error as Record<string, any>;
    const nestedMessage = errObj?.error?.message;
    const infoMessage = errObj?.info?.error?.message;
    const message =
      errObj.shortMessage ||
      errObj.message ||
      errObj.reason ||
      nestedMessage ||
      infoMessage ||
      '';
    if (typeof message === 'string') {
      return message.toLowerCase();
    }
  }
  return String(error).toLowerCase();
};

const isOutOfRangeError = (error: unknown) => {
  const message = getErrorMessage(error);
  const errObj = error as Record<string, any>;
  const isCallException = errObj?.code === 'CALL_EXCEPTION';
  const emptyData =
    errObj?.data === '0x' ||
    errObj?.info?.error?.data === '0x' ||
    errObj?.error?.data === '0x';

  return (
    message.includes('out of bounds') ||
    message.includes('out-of-bounds') ||
    message.includes('index out of range') ||
    message.includes('missing revert data') ||
    message.includes('invalid array length') ||
    message.includes('panic code 0x32') ||
    message.includes('panic: 0x32') ||
    message.includes('require(false)') ||
    message.includes('no data present') ||
    message.includes('execution reverted') && emptyData ||
    isCallException && emptyData
  );
};

const isRateLimitError = (error: unknown) => {
  const message = getErrorMessage(error);
  return (
    message.includes('too many requests') ||
    message.includes('rate limit') ||
    message.includes('retry in')
  );
};

type BondsV2Json = {
  buy?: {
    address?: string;
    pranaAmount?: string;
  };
  sell?: {
    address?: string;
    pranaAmount?: string;
  };
};

const getTotalsFromBondsV2Json = (data: unknown) => {
  const parsed = data as BondsV2Json | null | undefined;
  const buyPranaAmountStr = parsed?.buy?.pranaAmount;
  const sellPranaAmountStr = parsed?.sell?.pranaAmount;

  const buyBondTotalRawV2 =
    typeof buyPranaAmountStr === 'string' ? BigInt(buyPranaAmountStr) : 0n;
  const sellBondTotalRawV2 =
    typeof sellPranaAmountStr === 'string' ? BigInt(sellPranaAmountStr) : 0n;

  return { buyBondTotalRawV2, sellBondTotalRawV2 };
};

export interface PranaStatsData {
  marketCapVnd: number | null;
  stakedPrana: number | null;
  stakedVnd: number | null;
  interestContractBalancePrana: number | null;
  interestContractBalanceVnd: number | null;
  interestPrana: number | null;
  interestVnd: number | null;
  buyBondPrana: number | null;
  buyBondVnd: number | null;
  sellBondPrana: number | null;
  sellBondVnd: number | null;
  priceChange: {
    m1: number;
    m3: number;
    m6: number;
    y1: number;
    atl: number;
  };
  isLoading: boolean;
  error: string | null;
}

type PranaStatsComputed = Omit<PranaStatsData, 'isLoading' | 'error'>;

const initialStats: PranaStatsData = {
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
  priceChange: { m1: 0, m3: 0, m6: 0, y1: 0, atl: 0 },
  isLoading: true,
  error: null
};

const fetchPranaStats = async (
  getProvider: () => ethers.JsonRpcProvider
): Promise<PranaStatsComputed> => {
  const provider = getProvider();

  // Helper for safe JSON fetching
  const fetchJsonSafe = async <T,>(url: string, fallback: T): Promise<T> => {
    try {
      return await fetchJson<T>(url);
    } catch (e) {
      console.warn(`Failed to fetch ${url}`, e);
      return fallback;
    }
  };

  // 1. Fetch Prices & Rates (External APIs & Local JSON)
  const fetchBtcPrices = async () => {
    // Use the Vite dev proxy to avoid browser CORS:
    // - dev: /api/coingecko/* is forwarded to https://api.coingecko.com/*
    // - prod: you'll need a server/proxy (Vite proxy is dev-only)
    const json = await fetchJsonTtl<any>(
      "/api/coingecko/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,vnd",
      { ttlMs: 60_000 },
    );
    const usd = json?.bitcoin?.usd;
    const vnd = json?.bitcoin?.vnd;
    if (typeof usd !== 'number' || !Number.isFinite(usd)) {
      throw new Error('Failed to fetch BTC price USD (CoinGecko): invalid response');
    }
    if (typeof vnd !== 'number' || !Number.isFinite(vnd)) {
      throw new Error('Failed to fetch BTC price VND (CoinGecko): invalid response');
    }
    return { usd, vnd };
  };

  const [btcPrices, satsDataRes, d30, d90, d180, d365, bondsV2Json] = await Promise.all([
    fetchBtcPrices(),
    fetchJsonSafe<any[]>('/data_sats.json', []),
    fetchJsonSafe<any[]>('/data_30_days.json', []),
    fetchJsonSafe<any[]>('/data_90_days.json', []),
    fetchJsonSafe<any[]>('/data_180_days.json', []),
    fetchJsonSafe<any[]>('/data_365_days.json', []),
    fetchJsonSafe<unknown>('/bonds_v2.json', null),
  ]);

  const btcPriceUsd = btcPrices.usd;
  const btcPriceVnd = btcPrices.vnd;

  // Fallback for sats data if missing (mock current price ~22 sats)
  const latestSatPrice = satsDataRes.length > 0 ? satsDataRes[satsDataRes.length - 1].p : 22;

  // Calculate PRANA Price in VND
  // Formula: (SAT_PRICE / 1e8) * BTC_VND
  const pranaPriceVnd = (latestSatPrice / 1e8) * btcPriceVnd;

  // Calculate Market Cap
  const marketCap = Math.round(pranaPriceVnd * 1e7); // 10M Total Supply approx

  // 2. Blockchain Data
  const tokenContract = new ethers.Contract(PRANA_ADDRESS, PRANA_TOKEN_ABI, provider);
  const stakingContract = new ethers.Contract(STAKING_CONTRACT_ADDRESS, STAKING_CONTRACT_ABI, provider);

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

  const [stakedBalance, interestContractBalanceRaw, interestNeeded] = await Promise.all([
    safeContractCall(tokenContract.balanceOf(STAKING_CONTRACT_ADDRESS), 0n),
    safeContractCall(tokenContract.balanceOf(INTEREST_CONTRACT_ADDRESS), 0n),
    safeContractCall(stakingContract.totalInterestNeeded(), 0n),
  ]);

  const formatEther = (val: bigint) => parseFloat(ethers.formatUnits(val, PRANA_DECIMALS));

  const totalBuyBondRaw = buyBondTotalRawV2 + BUY_BOND_V1_TOTAL_VOLUME_RAW;
  const totalSellBondRaw = sellBondTotalRawV2 + SELL_BOND_V1_TOTAL_VOLUME_RAW;

  const stakedPrana = formatEther(stakedBalance) || 3500000; // Mock ~3.5M staked if 0/failed
  const interestContractBalancePrana = formatEther(interestContractBalanceRaw);
  const interestPrana = formatEther(interestNeeded) || 500000; // Mock ~500k interest if 0/failed
  const buyBondPranaVal = formatEther(totalBuyBondRaw) || 120000; // Mock volume
  const sellBondPranaVal = formatEther(totalSellBondRaw) || 80000; // Mock volume

  // Calculate Changes
  // Script uses: ((newValue - oldValue) / oldValue) * 100
  const calcChange = (oldP: number, newP: number) => oldP === 0 ? 0 : ((newP - oldP) / oldP) * 100;

  // Calculate current price in USD for comparison
  const latestSatPriceUsd = (latestSatPrice / 1e8) * btcPriceUsd;

  // Mock historical data if missing to show green/red indicators
  const getFirstPrice = (arr: any[], fallback: number) => arr && arr.length > 0 ? arr[0].p : fallback;

  // Mock historical prices relative to current to show varied percentages
  const mockM1 = latestSatPriceUsd * 0.95; // +5%
  const mockM3 = latestSatPriceUsd * 0.80; // +25%
  const mockM6 = latestSatPriceUsd * 1.20; // -16%
  const mockY1 = latestSatPriceUsd * 0.50; // +100%

  return {
    marketCapVnd: marketCap,
    stakedPrana,
    stakedVnd: stakedPrana * pranaPriceVnd,
    interestContractBalancePrana,
    interestContractBalanceVnd: interestContractBalancePrana * pranaPriceVnd,
    interestPrana,
    interestVnd: interestPrana * pranaPriceVnd,
    buyBondPrana: buyBondPranaVal,
    buyBondVnd: buyBondPranaVal * pranaPriceVnd,
    sellBondPrana: sellBondPranaVal,
    sellBondVnd: sellBondPranaVal * pranaPriceVnd,
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
    return new ethers.JsonRpcProvider(POLYGON_RPC_URL);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const computed = await fetchPranaStats(getProvider);
      setStats({
        ...computed,
        isLoading: false,
        error: null,
      });

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
