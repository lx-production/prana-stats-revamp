import { ethers } from 'ethers';
import { PRANA_DECIMALS } from '../constants/sharedContracts';

export const formatBigIntValue = (value: bigint) => {
  const stringValue = value.toString();
  return stringValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export const formatPranaDisplayFromRaw = (raw: bigint) => {
  const formatted = ethers.formatUnits(raw, PRANA_DECIMALS);
  const numeric = Number.parseFloat(formatted);
  const rounded = Number.isFinite(numeric) ? Math.round(numeric) : 0;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(rounded);
};

export const formatPranaFloatFromRaw = (val: bigint) => parseFloat(ethers.formatUnits(val, PRANA_DECIMALS));
