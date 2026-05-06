import { useMemo } from 'react';

type UseStakingAdditionalCapacityArgs = {
  /** Interest contract PRANA balance (whole units, not raw bigint). */
  interestBalancePrana: number | null | undefined;
  /** PRANA that is already committed/needed (whole units, not raw bigint). */
  interestCommittedPrana: number | null | undefined;
  /** APR as a fraction (e.g. 0.15 for 15%). Defaults to 15%. */
  apr?: number;
};

type UseStakingAdditionalCapacityResult = {
  /** Remaining PRANA in interest contract after committed amount is removed. */
  remainingInterestPrana: number | null;
  /**
   * Additional PRANA that can be staked while being able to pay 1 year of interest
   * from the remaining interest balance at the given APR:
   * additionalStakeCapacity = remainingInterest / apr
   */
  additionalStakeCapacityPrana: number | null;
};

export function useStakingAdditionalCapacity({
  interestBalancePrana,
  interestCommittedPrana,
  apr = 0.15,
}: UseStakingAdditionalCapacityArgs): UseStakingAdditionalCapacityResult {
  return useMemo(() => {
    const balance = typeof interestBalancePrana === 'number' ? interestBalancePrana : null;
    const committed = typeof interestCommittedPrana === 'number' ? interestCommittedPrana : null;

    if (!balance || balance <= 0 || !committed || committed < 0) {
      return { remainingInterestPrana: null, additionalStakeCapacityPrana: null };
    }

    const remainingInterestPrana = Math.max(0, balance - committed);
    if (!Number.isFinite(remainingInterestPrana) || remainingInterestPrana <= 0) {
      return { remainingInterestPrana: null, additionalStakeCapacityPrana: null };
    }

    if (!Number.isFinite(apr) || apr <= 0) {
      return { remainingInterestPrana, additionalStakeCapacityPrana: null };
    }

    const additionalStakeCapacityPrana = remainingInterestPrana / apr;
    if (!Number.isFinite(additionalStakeCapacityPrana) || additionalStakeCapacityPrana <= 0) {
      return { remainingInterestPrana, additionalStakeCapacityPrana: null };
    }

    return { remainingInterestPrana, additionalStakeCapacityPrana };
  }, [interestBalancePrana, interestCommittedPrana, apr]);
}

