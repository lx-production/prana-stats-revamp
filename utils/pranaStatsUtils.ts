import { ethers } from 'ethers';
import { PRANA_DECIMALS } from '../constants/sharedContracts.ts';
import type { SatsPerformanceInputs } from '../types/performance.ts';

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

export const parseAndSortPricePoints = (data: unknown) => {
  if (!Array.isArray(data)) return [];

  return data
    .filter((point): point is { t: number; p: number } =>
      typeof point?.t === 'number' && Number.isFinite(point.t) &&
      typeof point?.p === 'number' && Number.isFinite(point.p)
    )
    .sort((a, b) => a.t - b.t);
};

export const getPerformanceCutoffs = (nowUnixSeconds = Math.floor(Date.now() / 1000)) => ({
  m1Cutoff: nowUnixSeconds - (30 * 24 * 60 * 60),
  m3Cutoff: nowUnixSeconds - (90 * 24 * 60 * 60),
  m6Cutoff: nowUnixSeconds - (180 * 24 * 60 * 60),
  y1Cutoff: nowUnixSeconds - (365 * 24 * 60 * 60),
});

export const getPriceAtOrAfter = (
  arr: Array<{ t?: number; p?: number }>,
  cutoffUnixSeconds: number,
  fallback: number
) => {
  if (!arr || arr.length === 0) return fallback;

  const sorted = parseAndSortPricePoints(arr);

  if (sorted.length === 0) return fallback;

  const match = sorted.find((point) => point.t >= cutoffUnixSeconds);
  return match?.p ?? sorted[0].p;
};

export const getSatsPerformanceInputs = (
  satsData: unknown,
  latestSatPrice: number,
  nowUnixSeconds = Math.floor(Date.now() / 1000)
): SatsPerformanceInputs => {
  const { m1Cutoff, m3Cutoff, m6Cutoff, y1Cutoff } = getPerformanceCutoffs(nowUnixSeconds);
  const parsedSatsData = Array.isArray(satsData) ? satsData : [];

  const satsAtl = parsedSatsData.reduce((minPrice, point) => {
    const value = typeof point?.p === 'number' ? point.p : Number.NaN;
    if (!Number.isFinite(value)) return minPrice;
    return Math.min(minPrice, value);
  }, Number.POSITIVE_INFINITY);

  return {
    parsedSatsData,
    m1Cutoff,
    m3Cutoff,
    m6Cutoff,
    y1Cutoff,
    safeSatsAtl: Number.isFinite(satsAtl) ? satsAtl : latestSatPrice,
  };
};
