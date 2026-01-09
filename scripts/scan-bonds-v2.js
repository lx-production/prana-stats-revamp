import { ethers } from 'ethers';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { BUY_BOND_ADDRESS_V2, SELL_BOND_ADDRESS_V2, BUY_BOND_BONDS_ABI, SELL_BOND_BONDS_ABI } from '../constants/bonds.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const DEFAULT_RPC_FALLBACK = 'https://polygon-rpc.com';
const DEFAULT_MAX_BOND_SCAN = 20;
const REQUEST_DELAY_MS = 0;

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
    // Alchemy URLs typically embed the key in pathname; mask the last segment.
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

function isOutOfRangeError(error) {
  const message = getErrorMessage(error);
  const errObj = error;
  const isCallException = errObj?.code === 'CALL_EXCEPTION';
  const emptyData =
    errObj?.data === '0x' ||
    errObj?.info?.error?.data === '0x' ||
    errObj?.error?.data === '0x';

  return (
    message.includes('out of bounds') ||
    message.includes('out-of-bounds') ||
    message.includes('index out of range') ||
    message.includes('missing revert data') ||
    message.includes('invalid array length') ||
    message.includes('panic code 0x32') ||
    message.includes('panic: 0x32') ||
    message.includes('require(false)') ||
    message.includes('no data present') ||
    (message.includes('execution reverted') && emptyData) ||
    (isCallException && emptyData)
  );
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

async function scanBondTotals({ contract, label, maxScan }) {
  let index = 1;
  let count = 0;
  let pranaTotal = 0n;
  let wbtcTotal = 0n;

  while (index <= maxScan) {
    try {
      const bond = await contract.bonds(index);
      if (!bond) break;

      // Ethers v6 returns BigInt for uint256; keep it generic just in case.
      pranaTotal += toBigInt(bond?.pranaAmount);
      wbtcTotal += toBigInt(bond?.wbtcAmount);

      count += 1;
      index += 1;
      if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
    } catch (error) {
      if (isOutOfRangeError(error)) break;

      if (isRateLimitError(error)) {
        // back off a bit and retry the same index
        await sleep(2_000);
        continue;
      }

      console.warn(`Error fetching ${label} bond at index ${index}`, error);
      throw error;
    }
  }

  return {
    count,
    pranaAmount: pranaTotal.toString(),
    wbtcAmount: wbtcTotal.toString(),
  };
}

async function main() {
  await loadDotEnvIntoProcessEnv();

  const rpcUrl = getRpcUrl();
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const buyBondContract = new ethers.Contract(BUY_BOND_ADDRESS_V2, BUY_BOND_BONDS_ABI, provider);
  const sellBondContract = new ethers.Contract(SELL_BOND_ADDRESS_V2, SELL_BOND_BONDS_ABI, provider);

  console.log('Using RPC:', redactUrl(rpcUrl));
  console.log('BUY_BOND_ADDRESS_V2:', BUY_BOND_ADDRESS_V2);
  console.log('SELL_BOND_ADDRESS_V2:', SELL_BOND_ADDRESS_V2);

  const [buyTotals, sellTotals] = await Promise.all([
    scanBondTotals({
      contract: buyBondContract,
      label: 'buy',
      maxScan: DEFAULT_MAX_BOND_SCAN,
    }),
    scanBondTotals({
      contract: sellBondContract,
      label: 'sell',
      maxScan: DEFAULT_MAX_BOND_SCAN,
    }),
  ]);

  const out = {
    generatedAt: new Date().toISOString(),
    rpcUrl: redactUrl(rpcUrl),
    buy: {
      address: BUY_BOND_ADDRESS_V2,
      pranaAmount: buyTotals.pranaAmount,
      wbtcAmount: buyTotals.wbtcAmount,
    },
    sell: {
      address: SELL_BOND_ADDRESS_V2,
      pranaAmount: sellTotals.pranaAmount,
      wbtcAmount: sellTotals.wbtcAmount,
    },
  };

  const outPath = path.join(PROJECT_ROOT, 'bonds_v2.json');
  await fs.writeFile(outPath, JSON.stringify(out, null, 2), 'utf8');

  console.log(
    `Wrote totals for ${buyTotals.count} buy bonds and ${sellTotals.count} sell bonds to: ${outPath}`,
  );
}

main().catch((err) => {
  console.error('Failed to scan V2 bonds:', err);
  process.exitCode = 1;
});


