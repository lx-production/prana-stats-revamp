import { formatUnits, parseUnits } from 'viem';
import { PRANA_DECIMALS } from '../../constants/sharedContracts.ts';
import { SECONDS_PER_DAY, SECONDS_PER_YEAR } from '../../constants/network.ts';

import type {
  StakeAmountParseResult,
  StakeDisplayStatus,
  StakeRecord,
  StakingDurationOption,
} from './staking.types.ts';

const PERCENT_SCALE = 100n;

/**
 * Solidity-accurate total interest for a full duration:
 * annualInterest = amountRaw × APR / 100
 * interestPerSecond = annualInterest / 31,536,000
 * totalInterest = interestPerSecond × duration
 */
export function calculateTotalInterestRaw(
  amountRaw: bigint,
  apr: number,
  durationSeconds: number,
): bigint {
  if (amountRaw <= 0n || apr <= 0 || durationSeconds <= 0) return 0n;

  const annualInterest = (amountRaw * BigInt(apr)) / PERCENT_SCALE;
  const interestPerSecond = annualInterest / BigInt(SECONDS_PER_YEAR);
  return interestPerSecond * BigInt(durationSeconds);
}

/**
 * Accrued interest for `timePassedSeconds` using the same integer division order.
 * Callers should cap time at maturity (and later at grace rules in Bước 5).
 */
export function calculateAccruedInterestRaw(
  amountRaw: bigint,
  apr: number,
  timePassedSeconds: number,
): bigint {
  return calculateTotalInterestRaw(amountRaw, apr, timePassedSeconds);
}

/** Format raw PRANA units for UI display. */
export function formatPranaAmount(raw: bigint | string): string {
  const value = typeof raw === 'bigint' ? raw : BigInt(raw || '0');
  return formatUnits(value, PRANA_DECIMALS);
}

/**
 * Parse a user amount string into raw units.
 * Rejects empty/invalid/zero/negative and more than PRANA_DECIMALS fraction digits.
 */
export function parseStakeAmount(input: string): StakeAmountParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };

  // Allow leading digits + optional decimal part only (no scientific notation).
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    // Distinguish a leading minus from other junk.
    if (/^-\d+(\.\d+)?$/.test(trimmed)) return { ok: false, reason: 'negative' };
    return { ok: false, reason: 'invalid' };
  }

  const decimalPart = trimmed.split('.')[1];
  if (decimalPart && decimalPart.length > PRANA_DECIMALS) {
    return { ok: false, reason: 'too_many_decimals' };
  }

  try {
    const raw = parseUnits(trimmed, PRANA_DECIMALS);
    if (raw === 0n) return { ok: false, reason: 'zero' };
    return { ok: true, raw };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

/** True while the user is typing a plausible decimal (may still be incomplete). */
export function isStakeAmountInput(value: string): boolean {
  if (value === '') return true;
  if (!/^\d*\.?\d*$/.test(value)) return false;
  const decimalPart = value.split('.')[1];
  return !decimalPart || decimalPart.length <= PRANA_DECIMALS;
}

/** Prefer 30-day option when present; otherwise the first config option. */
export function getDefaultDurationSeconds(
  durations: StakingDurationOption[],
): number | null {
  if (durations.length === 0) return null;
  const thirtyDay = durations.find((option) => option.days === 30);
  return (thirtyDay ?? durations[0]).seconds;
}

export function daysFromSeconds(seconds: number): number {
  return Math.floor(seconds / SECONDS_PER_DAY);
}

export function getStakeEndTime(stake: StakeRecord): number {
  return stake.startTime + stake.durationSeconds;
}

export function getStakeDisplayStatus(
  stake: StakeRecord,
  nowSeconds: number,
): StakeDisplayStatus {
  return nowSeconds >= getStakeEndTime(stake) ? 'matured' : 'active';
}

/** Progress 0–100 toward maturity. */
export function getStakeProgressPercent(
  stake: StakeRecord,
  nowSeconds: number,
): number {
  if (stake.durationSeconds <= 0) return 100;
  const elapsed = Math.max(0, nowSeconds - stake.startTime);
  return Math.min(100, Math.floor((elapsed / stake.durationSeconds) * 100));
}

/**
 * Seconds of unclaimed accrual for interest preview.
 * Matches Solidity: accrual starts at lastClaimTime (never before startTime),
 * and caps at maturity.
 */
export function getEffectiveAccruedSeconds(
  stake: StakeRecord,
  nowSeconds: number,
): number {
  const endTime = getStakeEndTime(stake);
  const claimStart = Math.max(stake.lastClaimTime, stake.startTime);
  const effectiveNow = Math.min(nowSeconds, endTime);
  return Math.max(0, effectiveNow - claimStart);
}
