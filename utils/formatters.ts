import { ethers } from 'ethers';
import { PRANA_DECIMALS } from '../constants/sharedContracts.ts';

// Helper functions for formatting values in the UI

export const formatPranaFloatFromRaw = (val: bigint) =>
  parseFloat(ethers.formatUnits(val, PRANA_DECIMALS));

export const formatCurrency = (value: number | null, currency: 'VND' | 'PRANA') => {
  if (value === null || value === undefined) return 'Loading...';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: currency === 'PRANA' ? 0 : 0,
    maximumFractionDigits: currency === 'PRANA' ? 0 : 0,
  });
};

export const formatPercent = (value: number) => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(0)}%`;
};

export const formatNumber = (value: number, fractionDigits = 0) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
};

export const formatStatValue = (value: unknown) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return '--';
  return formatNumber(Math.round(numeric));
};

export const formatDate = (value: number) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const formatDateTime = (value: number) =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const formatFullVnd = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
