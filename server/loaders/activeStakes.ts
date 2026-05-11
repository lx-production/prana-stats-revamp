import path from 'node:path';
import fs from 'node:fs/promises';
import { ethers } from 'ethers';
import { PROJECT_ROOT } from '../projectRoot.ts';
import { readJsonIfExists } from '../../utils/jsonHelper.ts';
import { getServerPolygonProvider } from '../utils/providers.ts';
import { PRANA_DECIMALS } from '../../constants/sharedContracts.ts';
import { STAKING_CONTRACT_ABI, STAKING_CONTRACT_ADDRESS } from '../../constants/stakingContracts.ts';
import type { ActiveStake, ActiveStakesResult, StakeData } from '../../types/activeStakes.types.ts';
import { formatUnixSecondsToHuman, getRpcUrl, isRateLimitError, redactUrl, sleep, toBigInt, toNumberSafe } from '../../scripts/utils/fetchActiveStakesUtils.ts';

const ACTIVE_STAKES_FILENAME = 'active_stakes.json';
const ACTIVE_STAKES_PATH = path.join(PROJECT_ROOT, ACTIVE_STAKES_FILENAME);
const SECONDS_PER_DAY = 86_400n;
const SECONDS_PER_YEAR = 365n * SECONDS_PER_DAY;
const PERCENT_SCALE = 100n;

async function getStakerStakesWithRetry(
  stakingContract: ethers.Contract,
  staker: string,
): Promise<StakeData[]> {
  for (;;) {
    try {
      return (await stakingContract.getStakerStakes(staker)) as StakeData[];
    } catch (err) {
      if (isRateLimitError(err)) {
        await sleep(2_000);
        continue;
      }
      throw err;
    }
  }
}

export function calculateDailyInterestPrana(activeStakes: ActiveStake[]): number {
  return activeStakes.reduce((total, stake) => {
    const amountPrana = Number.parseFloat(stake.amountPrana);
    if (!Number.isFinite(amountPrana) || amountPrana <= 0 || stake.apr <= 0) return total;
    return total + (amountPrana * stake.apr) / 100 / 365;
  }, 0);
}

function calculateInterestRaw(amountRaw: bigint, apr: number, seconds: bigint): bigint {
  if (amountRaw <= 0n || apr <= 0 || seconds <= 0n) return 0n;

  const annualInterestRaw = (amountRaw * BigInt(apr)) / PERCENT_SCALE;
  const interestPerSecondRaw = annualInterestRaw / SECONDS_PER_YEAR;
  return interestPerSecondRaw * seconds;
}

function formatPranaRawToNumber(amountRaw: bigint): number {
  return Number.parseFloat(ethers.formatUnits(amountRaw, PRANA_DECIMALS));
}

export async function fetchActiveStakesSnapshot(): Promise<ActiveStakesResult> {
  const provider = await getServerPolygonProvider();
  const stakingContract = new ethers.Contract(
    STAKING_CONTRACT_ADDRESS,
    STAKING_CONTRACT_ABI,
    provider,
  );

  const [block, gracePeriodValue] = await Promise.all([
    provider.getBlock('latest'),
    stakingContract.gracePeriod(),
  ]);
  const blockTimestamp = block?.timestamp ?? 0;
  const blockNumber = block?.number ?? null;
  const now = BigInt(blockTimestamp);
  const stakers: string[] = await stakingContract.getStakers();
  const gracePeriod = toBigInt(gracePeriodValue);

  const activeStakes: ActiveStake[] = [];
  let totalStakesSeen = 0;
  let lastStakeId = 0;
  let claimableStakesCount = 0;
  let dailyInterestRaw = 0n;
  let claimableUnclaimedInterestRaw = 0n;
  let latestMatureTime: bigint | null = null;

  for (const staker of stakers) {
    const stakes = await getStakerStakesWithRetry(stakingContract, staker);

    for (const s of stakes) {
      totalStakesSeen += 1;
      const stakeId = toNumberSafe(s?.id);
      lastStakeId = Math.max(lastStakeId, stakeId);

      const startTime = toBigInt(s.startTime);
      const duration = toBigInt(s.duration);
      const endTime = startTime + duration;
      const amountRaw = toBigInt(s.amount);
      const apr = toNumberSafe(s.apr);
      const lastClaimTime = toBigInt(s.lastClaimTime);
      const isActive = now < endTime;
      const isMaturedClaimable =
        now >= endTime && now <= endTime + gracePeriod && lastClaimTime < endTime;

      if (isActive) {
        dailyInterestRaw += calculateInterestRaw(amountRaw, apr, SECONDS_PER_DAY);
        latestMatureTime = latestMatureTime === null || endTime > latestMatureTime
          ? endTime
          : latestMatureTime;
      }

      if (isActive || isMaturedClaimable) {
        const effectiveTime = isActive ? now : endTime;
        const claimableSeconds = effectiveTime > lastClaimTime
          ? effectiveTime - lastClaimTime
          : 0n;
        const claimableInterestRaw = calculateInterestRaw(amountRaw, apr, claimableSeconds);
        if (claimableInterestRaw > 0n) {
          claimableStakesCount += 1;
          claimableUnclaimedInterestRaw += claimableInterestRaw;
        }
      }

      if (now >= endTime) continue;

      const remainingSeconds = endTime > now ? endTime - now : 0n;
      const matureHuman = formatUnixSecondsToHuman(endTime);
      const startHuman = formatUnixSecondsToHuman(startTime);

      activeStakes.push({
        stakeId,
        staker,
        amountRaw: amountRaw.toString(),
        amountPrana: ethers.formatUnits(amountRaw, PRANA_DECIMALS),
        startTime: startTime.toString(),
        startTimeIso: startHuman.iso,
        startTimeLocal: startHuman.local,
        durationSeconds: duration.toString(),
        durationDays: Number(duration) / 86400,
        apr,
        lastClaimTime: lastClaimTime.toString(),
        matureTime: endTime.toString(),
        matureTimeIso: matureHuman.iso,
        matureTimeLocal: matureHuman.local,
        remainingSeconds: remainingSeconds.toString(),
      });
    }
  }

  activeStakes.sort((a, b) => a.stakeId - b.stakeId);

  return {
    generatedAt: new Date().toISOString(),
    rpcUrl: redactUrl(getRpcUrl()),
    contract: {
      address: STAKING_CONTRACT_ADDRESS,
    },
    chain: {
      blockNumber,
      blockTimestamp,
    },
    scan: {
      lastStakeId,
      stakersCount: stakers.length,
      totalStakesSeen,
      activeStakesCount: activeStakes.length,
      claimableStakesCount,
    },
    interest: {
      dailyInterestPrana: formatPranaRawToNumber(dailyInterestRaw),
      claimableUnclaimedInterestPrana: formatPranaRawToNumber(claimableUnclaimedInterestRaw),
      latestMatureTime: latestMatureTime?.toString() ?? null,
    },
    activeStakes,
  };
}

export async function loadActiveStakesSnapshot(): Promise<ActiveStakesResult> {
  try {
    const snapshot = await fetchActiveStakesSnapshot();
    await fs.writeFile(ACTIVE_STAKES_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
    return snapshot;
  } catch (err) {
    const cachedSnapshot = await readJsonIfExists<ActiveStakesResult>(ACTIVE_STAKES_PATH);
    if (cachedSnapshot && Array.isArray(cachedSnapshot.activeStakes)) return cachedSnapshot;
    throw err;
  }
}
