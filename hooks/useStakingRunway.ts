import { useMemo } from 'react';

type UseStakingRunwayArgs = {
  /** Interest contract PRANA balance (whole units, not raw bigint). */
  interestBalancePrana: number | null | undefined;
  /** Total committed staking interest (whole units, not raw bigint). */
  interestCommittedPrana: number | null | undefined;
  /** Days from now until the latest active stake matures. */
  daysUntilLatestMaturity?: number | null | undefined;
  /** Total value staked in PRANA (whole units, not raw bigint). */
  totalStakedPrana: number | null | undefined;
  /** APR as a fraction (e.g. 0.15 for 15%). Defaults to 15%. */
  apr?: number;
};

type UseStakingRunwayResult = {
  /** Days from now until the latest funded-through estimate. */
  surplusRunwayRemainingDays: number | null;
  /** Estimated PRANA paid per day at the current staked + APR assumptions. */
  dailyInterestPrana: number | null;
};

export function useStakingRunway({
  interestBalancePrana,
  interestCommittedPrana,
  daysUntilLatestMaturity,
  totalStakedPrana,
  apr = 0.15,
}: UseStakingRunwayArgs): UseStakingRunwayResult {
  return useMemo(() => {
    const interest = typeof interestBalancePrana === 'number' ? interestBalancePrana : null;
    const committed = typeof interestCommittedPrana === 'number' ? interestCommittedPrana : null;
    const daysToLatestMaturity = typeof daysUntilLatestMaturity === 'number'
      ? daysUntilLatestMaturity
      : null;
    const staked = typeof totalStakedPrana === 'number' ? totalStakedPrana : null;
    if (!interest || committed === null || daysToLatestMaturity === null || !staked || interest <= 0 || staked <= 0) {
      return { surplusRunwayRemainingDays: null, dailyInterestPrana: null };
    }

    const dailyInterestPrana = (staked * apr) / 365;
    if (!Number.isFinite(dailyInterestPrana) || dailyInterestPrana <= 0) {
      return { surplusRunwayRemainingDays: null, dailyInterestPrana: null };
    }

    const surplusDays = (interest - committed) / dailyInterestPrana;
    const surplusRunwayRemainingDays = daysToLatestMaturity + surplusDays;
    if (!Number.isFinite(surplusRunwayRemainingDays) || surplusRunwayRemainingDays <= 0) {
      return { surplusRunwayRemainingDays: null, dailyInterestPrana: null };
    }

    return { surplusRunwayRemainingDays, dailyInterestPrana };
  }, [interestBalancePrana, interestCommittedPrana, daysUntilLatestMaturity, totalStakedPrana, apr]);
}

