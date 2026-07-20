import { SECONDS_PER_DAY } from '../../constants/network.ts';
import { toBigInt, toNumberSafe } from '../../utils/fetchActiveStakesUtils.ts';

import type { StakeRecord, StakingDurationOption } from '../../features/staking/staking.types.ts';

/** Map on-chain getAllAPRs parallel arrays into API duration options. */
export function mapDurationOptions(
  durations: readonly unknown[],
  aprs: readonly unknown[],
): StakingDurationOption[] {
  const count = Math.min(durations.length, aprs.length);
  const options: StakingDurationOption[] = [];

  for (let index = 0; index < count; index += 1) {
    const seconds = toNumberSafe(durations[index]);
    const apr = toNumberSafe(aprs[index]);
    if (seconds <= 0 || apr <= 0) continue;

    options.push({
      seconds,
      days: seconds / SECONDS_PER_DAY,
      apr,
    });
  }

  return options;
}

/** Normalize getStakerStakes tuples into JSON-safe stake records. */
export function mapStakeRecords(rawStakes: readonly unknown[]): StakeRecord[] {
  return rawStakes.map((raw) => {
    const stake = raw as {
      id?: unknown;
      amount?: unknown;
      startTime?: unknown;
      duration?: unknown;
      apr?: unknown;
      lastClaimTime?: unknown;
    };

    return {
      id: toNumberSafe(stake.id),
      amountRaw: toBigInt(stake.amount).toString(),
      startTime: toNumberSafe(stake.startTime),
      durationSeconds: toNumberSafe(stake.duration),
      apr: toNumberSafe(stake.apr),
      lastClaimTime: toNumberSafe(stake.lastClaimTime),
    };
  });
}
