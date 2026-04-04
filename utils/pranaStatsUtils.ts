import { ethers } from 'ethers';
import { PRANA_DECIMALS } from '../constants/sharedContracts.ts';
import type { SatsPerformanceInputs } from '../types/performance.ts';
import type { PricePoint } from '../types/pricePoint.ts';

export const safeContractCall = async (call: Promise<any>, fallback: any) => {
  try {
    return await call;
  } catch (e) {
    console.warn("Contract call failed", e);
    return fallback;
  }
};

export const asBigInt = (value: any) =>
  typeof value === 'bigint' ? value : BigInt(value?.toString?.() ?? '0');

export const formatEther = (val: bigint) =>
  parseFloat(ethers.formatUnits(val, PRANA_DECIMALS));

export const calcChange = (oldP: number, newP: number) =>
  oldP === 0 ? 0 : ((newP - oldP) / oldP) * 100;

export const getPerformanceCutoffs = (nowUnixSeconds = Math.floor(Date.now() / 1000)) => ({
  m1Cutoff: nowUnixSeconds - (30 * 24 * 60 * 60),
  m3Cutoff: nowUnixSeconds - (90 * 24 * 60 * 60),
  m6Cutoff: nowUnixSeconds - (180 * 24 * 60 * 60),
  y1Cutoff: nowUnixSeconds - (365 * 24 * 60 * 60),
});

export const getPriceAtOrAfter = (
  arr: PricePoint[],
  cutoffUnixSeconds: number,
  fallback: number
) => {
  if (!arr || arr.length === 0) return fallback;

  const match = arr.find((point) => point.t >= cutoffUnixSeconds);
  return match?.p ?? arr[0].p;
};

export const getSatsPerformanceInputs = (
  satsData: PricePoint[],
  latestSatPrice: number,
  nowUnixSeconds = Math.floor(Date.now() / 1000)
): SatsPerformanceInputs => {
  const { m1Cutoff, m3Cutoff, m6Cutoff, y1Cutoff } = getPerformanceCutoffs(nowUnixSeconds);

  const satsAtl = satsData.reduce(
    (minPrice, point) => Math.min(minPrice, point.p),
    Number.POSITIVE_INFINITY
  );

  return {
    parsedSatsData: satsData,
    m1Cutoff,
    m3Cutoff,
    m6Cutoff,
    y1Cutoff,
    safeSatsAtl: Number.isFinite(satsAtl) ? satsAtl : latestSatPrice,
  };
};
