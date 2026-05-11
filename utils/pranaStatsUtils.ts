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

