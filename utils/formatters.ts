import { ethers } from 'ethers';
import { PRANA_DECIMALS } from '../constants/sharedContracts.ts';

const MISSING_VALUE = 'N/A';

export const formatPranaFloatFromRaw = (val: bigint) =>
  parseFloat(ethers.formatUnits(val, PRANA_DECIMALS));

export const formatCurrency = (value: number | null, currency: 'VND' | 'PRANA') => {
  if (value === null || value === undefined) return 'Loading...';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: currency === 'PRANA' ? 0 : 0,
    maximumFractionDigits: currency === 'PRANA' ? 0 : 0,
  });
};

export const formatNumber = (value: number, fractionDigits = 0) => {
  if (!Number.isFinite(value)) return MISSING_VALUE;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
};

export const formatUsd = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return MISSING_VALUE;
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
};

export const formatVnd = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return MISSING_VALUE;
  return `${formatNumber(value)} VND`;
};

export const formatFullVnd = (value: number) => formatNumber(value, 0);

export const formatPercent = (
  value: number | null | undefined,
  fractionDigits = 2,
  showSign = true,
): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return MISSING_VALUE;
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${formatNumber(value, fractionDigits)}%`;
};

export const formatSats = (value: string | null | undefined): string => {
  const numeric = typeof value === 'string' ? Number(value.replace(/,/g, '')) : NaN;
  return Number.isFinite(numeric) ? `${formatNumber(numeric)} SAT` : MISSING_VALUE;
};

export const formatStatValue = (value: unknown) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return '--';
  return formatNumber(Math.round(numeric));
};

export const formatDate = (value: number) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const formatUnixDate = (timestamp: number, locale = 'en-US'): string =>
  new Date(timestamp * 1000).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

export const formatDateTime = (value: number) =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
