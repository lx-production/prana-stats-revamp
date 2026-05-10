import { useMemo } from 'react';

type UseStakingRunwayArgs = {
  /** Interest contract PRANA balance (whole units, not raw bigint). */
  interestBalancePrana: number | null | undefined;
  /** Interest that users can already claim (whole units, not raw bigint). */
  claimableUnclaimedInterestPrana?: number | null | undefined;
  /** Total value staked in PRANA (whole units, not raw bigint). */
  totalStakedPrana: number | null | undefined;
  /** APR as a fraction (e.g. 0.15 for 15%). Defaults to 15%. */
  apr?: number;
};

type UseStakingRunwayResult = {
  /** Estimated runway in days until interest balance reaches 0. */
  runwayDays: number | null;
  /** Estimated PRANA paid per day at the current staked + APR assumptions. */
  dailyInterestPrana: number | null;
};

export function useStakingRunway({
  interestBalancePrana,
  claimableUnclaimedInterestPrana,
  totalStakedPrana,
  apr = 0.15,
}: UseStakingRunwayArgs): UseStakingRunwayResult {
  return useMemo(() => {
    const interest = typeof interestBalancePrana === 'number' ? interestBalancePrana : null;
    const claimableInterest =
      typeof claimableUnclaimedInterestPrana === 'number'
        ? claimableUnclaimedInterestPrana
        : 0;
    const staked = typeof totalStakedPrana === 'number' ? totalStakedPrana : null;
    if (!interest || !staked || interest <= 0 || staked <= 0) {
      return { runwayDays: null, dailyInterestPrana: null };
    }

    const dailyInterestPrana = (staked * apr) / 365;
    if (!Number.isFinite(dailyInterestPrana) || dailyInterestPrana <= 0) {
      return { runwayDays: null, dailyInterestPrana: null };
    }

    const runwayBalancePrana = Math.max(interest - claimableInterest, 0);
    const runwayDays = runwayBalancePrana / dailyInterestPrana;
    if (!Number.isFinite(runwayDays) || runwayDays <= 0) {
      return { runwayDays: null, dailyInterestPrana: null };
    }

    return { runwayDays, dailyInterestPrana };
  }, [interestBalancePrana, claimableUnclaimedInterestPrana, totalStakedPrana, apr]);
}

