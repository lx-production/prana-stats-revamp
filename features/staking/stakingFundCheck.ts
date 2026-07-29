import { calculateTotalInterestRaw } from './stakingMath.ts';

import type { StakingQuoteIssue } from './staking.types.ts';

/**
 * Interest still free for new stakes:
 * available = balanceOf(Interest) − totalInterestNeeded()
 * Floors at 0 when the contract is already under-reserved.
 */
export function availableInterestFundRaw(
  interestBalanceRaw: bigint,
  totalInterestNeededRaw: bigint,
): bigint {
  return interestBalanceRaw > totalInterestNeededRaw
    ? interestBalanceRaw - totalInterestNeededRaw
    : 0n;
}

/** True when the Interest contract can cover this stake's full maturity interest. */
export function isNewStakeFullyFunded(
  availableFundRaw: bigint,
  newStakeInterestRaw: bigint,
): boolean {
  return newStakeInterestRaw <= availableFundRaw;
}

export type ComputeStakingQuoteInput = {
  amountRaw: bigint;
  durationSeconds: number;
  /** null when the duration is not in getAllAPRs at this block. */
  apr: number | null;
  paused: boolean;
  minStakeRaw: bigint;
  interestBalanceRaw: bigint;
  totalInterestNeededRaw: bigint;
};

export type ComputeStakingQuoteResult = {
  apr: number;
  newStakeInterestRaw: bigint;
  availableInterestFundRaw: bigint;
  issues: StakingQuoteIssue[];
};

/**
 * Pure fully-funded quote math (Solidity interest order + soft issues).
 * Loader supplies same-block chain reads; this never touches RPC.
 */
export function computeStakingQuote(
  input: ComputeStakingQuoteInput,
): ComputeStakingQuoteResult {
  const issues: StakingQuoteIssue[] = [];

  if (input.paused) {
    issues.push('paused');
  }

  const available = availableInterestFundRaw(
    input.interestBalanceRaw,
    input.totalInterestNeededRaw,
  );

  if (input.amountRaw <= 0n) {
    issues.push('zero_amount');
    return {
      apr: 0,
      newStakeInterestRaw: 0n,
      availableInterestFundRaw: available,
      issues,
    };
  }

  if (input.apr == null || input.apr <= 0 || input.durationSeconds <= 0) {
    issues.push('invalid_duration');
    return {
      apr: 0,
      newStakeInterestRaw: 0n,
      availableInterestFundRaw: available,
      issues,
    };
  }

  if (input.amountRaw < input.minStakeRaw) {
    issues.push('below_minimum');
  }

  const newStakeInterestRaw = calculateTotalInterestRaw(
    input.amountRaw,
    input.apr,
    input.durationSeconds,
  );

  if (!isNewStakeFullyFunded(available, newStakeInterestRaw)) {
    issues.push('insufficient_interest_fund');
  }

  return {
    apr: input.apr,
    newStakeInterestRaw,
    availableInterestFundRaw: available,
    issues,
  };
}
