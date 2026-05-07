import path from 'node:path';
import fs from 'node:fs/promises';
import { ethers } from 'ethers';
import { PROJECT_ROOT } from '../projectRoot.ts';
import { getServerPolygonProvider } from '../utils/providers.ts';
import { PRANA_DECIMALS } from '../../constants/sharedContracts.ts';
import { STAKING_CONTRACT_ABI, STAKING_CONTRACT_ADDRESS } from '../../constants/stakingContracts.ts';
import type { ActiveStake, ActiveStakesResult, StakeData } from '../../types/activeStakes.types.ts';
import { formatUnixSecondsToHuman, getRpcUrl, isRateLimitError, redactUrl, sleep, toBigInt, toNumberSafe } from '../../scripts/utils/fetchActiveStakesUtils.ts';

const ACTIVE_STAKES_FILENAME = 'active_stakes.json';
const ACTIVE_STAKES_PATH = path.join(PROJECT_ROOT, ACTIVE_STAKES_FILENAME);

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

async function readActiveStakesSnapshot(): Promise<ActiveStakesResult | null> {
  try {
    const raw = await fs.readFile(ACTIVE_STAKES_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ActiveStakesResult>;
    if (!Array.isArray(parsed.activeStakes)) return null;
    return parsed as ActiveStakesResult;
  } catch {
    return null;
  }
}

export function calculateDailyInterestPrana(activeStakes: ActiveStake[]): number {
  return activeStakes.reduce((total, stake) => {
    const amountPrana = Number.parseFloat(stake.amountPrana);
    if (!Number.isFinite(amountPrana) || amountPrana <= 0 || stake.apr <= 0) return total;
    return total + (amountPrana * stake.apr) / 100 / 365;
  }, 0);
}

export async function fetchActiveStakesSnapshot(): Promise<ActiveStakesResult> {
  const provider = await getServerPolygonProvider();
  const stakingContract = new ethers.Contract(
    STAKING_CONTRACT_ADDRESS,
    STAKING_CONTRACT_ABI,
    provider,
  );

  const block = await provider.getBlock('latest');
  const blockTimestamp = block?.timestamp ?? 0;
  const blockNumber = block?.number ?? null;
  const now = BigInt(blockTimestamp);
  const stakers: string[] = await stakingContract.getStakers();

  const activeStakes: ActiveStake[] = [];
  let totalStakesSeen = 0;
  let lastStakeId = 0;

  for (const staker of stakers) {
    const stakes = await getStakerStakesWithRetry(stakingContract, staker);

    for (const s of stakes) {
      totalStakesSeen += 1;
      const stakeId = toNumberSafe(s?.id);
      lastStakeId = Math.max(lastStakeId, stakeId);

      const startTime = toBigInt(s.startTime);
      const duration = toBigInt(s.duration);
      const endTime = startTime + duration;
      if (now >= endTime) continue;

      const remainingSeconds = endTime > now ? endTime - now : 0n;
      const matureHuman = formatUnixSecondsToHuman(endTime);
      const startHuman = formatUnixSecondsToHuman(startTime);

      activeStakes.push({
        stakeId,
        staker,
        amountRaw: toBigInt(s.amount).toString(),
        amountPrana: ethers.formatUnits(toBigInt(s.amount), PRANA_DECIMALS),
        startTime: startTime.toString(),
        startTimeIso: startHuman.iso,
        startTimeLocal: startHuman.local,
        durationSeconds: duration.toString(),
        durationDays: Number(duration) / 86400,
        apr: toNumberSafe(s.apr),
        lastClaimTime: toBigInt(s.lastClaimTime).toString(),
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
    const cachedSnapshot = await readActiveStakesSnapshot();
    if (cachedSnapshot) return cachedSnapshot;
    throw err;
  }
}
