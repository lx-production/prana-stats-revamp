import { ethers } from 'ethers';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { STAKING_CONTRACT_ADDRESS } from '../constants/stakingContracts.js';
import { PRANA_DECIMALS } from '../constants/sharedContracts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const DEFAULT_RPC_FALLBACK = 'https://polygon-rpc.com';
const LAST_STAKE_ID = 30;

const STAKING_CONTRACT_ABI = [
  'function getStakers() view returns (address[])',
  'function getStakerStakes(address staker) view returns (tuple(uint32 id,uint256 amount,uint256 startTime,uint256 duration,uint8 apr,uint256 lastClaimTime)[])',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseDotEnv(content) {
  const env = {};
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const cleaned = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const eq = cleaned.indexOf('=');
    if (eq === -1) continue;

    const key = cleaned.slice(0, eq).trim();
    let value = cleaned.slice(eq + 1).trim();

    // remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) env[key] = value;
  }
  return env;
}

async function loadDotEnvIntoProcessEnv() {
  const candidates = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.development.local',
    '.env.production',
    '.env.production.local',
  ];

  for (const filename of candidates) {
    const fullPath = path.join(PROJECT_ROOT, filename);
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      const parsed = parseDotEnv(content);
      for (const [k, v] of Object.entries(parsed)) {
        if (process.env[k] === undefined) process.env[k] = v;
      }
    } catch {
      // ignore missing files
    }
  }
}

function getRpcUrl() {
  return (
    process.env.VITE_ALCHEMY_POLYGON_MAIN ||
    process.env.POLYGON_RPC_URL ||
    DEFAULT_RPC_FALLBACK
  );
}

function redactUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length > 0) {
      parts[parts.length - 1] = '<redacted>';
      u.pathname = '/' + parts.join('/');
    }
    return u.toString();
  } catch {
    return '<invalid url>';
  }
}

function getErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error.toLowerCase();
  if (typeof error === 'object') {
    const errObj = error;
    const nestedMessage = errObj?.error?.message;
    const infoMessage = errObj?.info?.error?.message;
    const message =
      errObj?.shortMessage ||
      errObj?.message ||
      errObj?.reason ||
      nestedMessage ||
      infoMessage ||
      '';
    if (typeof message === 'string') return message.toLowerCase();
  }
  return String(error).toLowerCase();
}

function isRateLimitError(error) {
  const message = getErrorMessage(error);
  return (
    message.includes('too many requests') ||
    message.includes('rate limit') ||
    message.includes('retry in')
  );
}

function toBigInt(value) {
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(value);
    if (typeof value === 'string' && value.length > 0) return BigInt(value);
    if (value && typeof value.toString === 'function') return BigInt(value.toString());
  } catch {
    // ignore parse failures and treat as 0
  }
  return 0n;
}

function toNumberSafe(value) {
  const b = toBigInt(value);
  if (b > BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER;
  return Number(b);
}

function formatUnixSecondsToHuman(unixSeconds) {
  const ms = toNumberSafe(unixSeconds) * 1000;
  const d = new Date(ms);
  return {
    iso: d.toISOString(),
    local: d.toLocaleString(),
  };
}

async function main() {
  await loadDotEnvIntoProcessEnv();

  const rpcUrl = getRpcUrl();
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const stakingContract = new ethers.Contract(STAKING_CONTRACT_ADDRESS, STAKING_CONTRACT_ABI, provider);

  const block = await provider.getBlock('latest');
  const blockTimestamp = block?.timestamp ?? 0;
  const blockNumber = block?.number ?? null;
  const now = BigInt(blockTimestamp);

  console.log('Using RPC:', redactUrl(rpcUrl));
  console.log('STAKING_CONTRACT_ADDRESS:', STAKING_CONTRACT_ADDRESS);
  console.log('Latest block:', blockNumber, 'timestamp:', blockTimestamp);

  const stakers = await stakingContract.getStakers();

  // Build a global stakeId -> stake details map (stake ids are globally unique).
  const stakeById = new Map();
  let totalStakesSeen = 0;

  for (const staker of stakers) {
    let stakes;
    // small retry for rate limits
    for (;;) {
      try {
        stakes = await stakingContract.getStakerStakes(staker);
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
      // in case of duplicates (shouldn't happen), keep the first and skip the rest
      if (!stakeById.has(stakeId)) {
        stakeById.set(stakeId, { staker, stake: s });
      }
    }
  }

  const activeStakes = [];

  // "Looping technique": iterate stakeId 1..LAST_STAKE_ID
  for (let stakeId = 1; stakeId <= LAST_STAKE_ID; stakeId += 1) {
    const entry = stakeById.get(stakeId);
    if (!entry) continue;

    const { staker, stake } = entry;
    const startTime = toBigInt(stake?.startTime);
    const duration = toBigInt(stake?.duration);
    const endTime = startTime + duration;
    const isActive = now < endTime;
    if (!isActive) continue;

    const remainingSeconds = endTime > now ? endTime - now : 0n;
    const matureHuman = formatUnixSecondsToHuman(endTime);
    const startHuman = formatUnixSecondsToHuman(startTime);

    activeStakes.push({
      stakeId,
      staker,
      amountRaw: toBigInt(stake?.amount).toString(),
      amountPrana: ethers.formatUnits(toBigInt(stake?.amount), PRANA_DECIMALS),
      startTime: startTime.toString(),
      startTimeIso: startHuman.iso,
      startTimeLocal: startHuman.local,
      durationSeconds: duration.toString(),
      durationDays: Number(duration) / 86400,
      apr: toNumberSafe(stake?.apr),
      lastClaimTime: toBigInt(stake?.lastClaimTime).toString(),
      matureTime: endTime.toString(),
      matureTimeIso: matureHuman.iso,
      matureTimeLocal: matureHuman.local,
      remainingSeconds: remainingSeconds.toString(),
    });
  }

  activeStakes.sort((a, b) => a.stakeId - b.stakeId);

  const out = {
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
      lastStakeId: LAST_STAKE_ID,
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

