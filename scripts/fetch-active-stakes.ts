import { ethers } from 'ethers';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { STAKING_CONTRACT_ADDRESS, STAKING_CONTRACT_ABI } from '../constants/stakingContracts.ts';
import { PRANA_DECIMALS } from '../constants/sharedContracts.ts';
import type { ActiveStake, ActiveStakesResult, StakeData } from './types/fetchActiveStakesTypes.ts';
import { formatUnixSecondsToHuman, getRpcUrl, isRateLimitError, loadDotEnvIntoProcessEnv, redactUrl, sleep, toBigInt, toNumberSafe } from './utils/fetchActiveStakesUtils.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

async function main(): Promise<void> {
  await loadDotEnvIntoProcessEnv(PROJECT_ROOT);

  const rpcUrl = getRpcUrl();
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
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
    let stakes: StakeData[] = [];
    for (;;) {
      try {
        stakes = (await stakingContract.getStakerStakes(staker)) as StakeData[];
        break;
      } catch (err) {
        if (isRateLimitError(err)) {
          await sleep(2_000);
          continue;
        }
        throw err;
      }
    }

    for (const s of stakes) {
      totalStakesSeen += 1;
      const stakeId = toNumberSafe(s?.id);
      lastStakeId = Math.max(lastStakeId, stakeId);

      const startTime = toBigInt(s.startTime);
      const duration = toBigInt(s.duration);
      const endTime = startTime + duration;
      const isActive = now < endTime;
      if (!isActive) continue;

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

  const out: ActiveStakesResult = {
    generatedAt: new Date().toISOString(),
    rpcUrl: redactUrl(rpcUrl),
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

  const outPath = path.join(PROJECT_ROOT, 'active_stakes.json');
  await fs.writeFile(outPath, JSON.stringify(out, null, 2), 'utf8');

  console.log(`Wrote ${activeStakes.length} active stakes to: ${outPath}`);
}

main().catch((err) => {
  console.error('Failed to fetch active stakes:', err);
  process.exitCode = 1;
});
