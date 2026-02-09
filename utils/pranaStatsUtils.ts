import { ethers } from 'ethers';
import { PRANA_DECIMALS } from '../constants/sharedContracts';

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

export const getFirstPrice = (arr: any[], fallback: number) =>
  arr && arr.length > 0 ? arr[0].p : fallback;
