import { ethers } from 'ethers';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PRANA_ADDRESS, PRANA_DECIMALS } from '../constants/sharedContracts.js';
import { TOP_HOLDING_ADDRESSES } from '../constants/topHoldingAddresses.js';
import { loadDotEnvIntoProcessEnv, getRpcUrl, redactUrl, PROJECT_ROOT } from '../utils/bondsScanUtils.js';

const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const PRANA_BALANCE_OF_ABI = ['function balanceOf(address owner) view returns (uint256)'];
const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target,bool allowFailure,bytes callData)[] calls) payable returns (tuple(bool success,bytes returnData)[] returnData)',
];

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchBalancesViaMulticall(provider) {
  const iface = new ethers.Interface(PRANA_BALANCE_OF_ABI);
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);

  const calls = TOP_HOLDING_ADDRESSES.map((holder) => ({
    target: PRANA_ADDRESS,
    allowFailure: true,
    callData: iface.encodeFunctionData('balanceOf', [holder.address]),
  }));

  const results = await multicall.aggregate3.staticCall(calls);
  return results.map((result) => {
    if (!result?.success || typeof result.returnData !== 'string') return 0n;
    try {
      const [raw] = iface.decodeFunctionResult('balanceOf', result.returnData);
      return typeof raw === 'bigint' ? raw : BigInt(raw?.toString?.() ?? '0');
    } catch {
      return 0n;
    }
  });
}

async function fetchBalancesViaFallback(provider) {
  const token = new ethers.Contract(PRANA_ADDRESS, PRANA_BALANCE_OF_ABI, provider);
  const raw = await Promise.all(
    TOP_HOLDING_ADDRESSES.map(async (holder) => {
      try {
        const value = await token.balanceOf(holder.address);
        return typeof value === 'bigint' ? value : BigInt(value?.toString?.() ?? '0');
      } catch {
        return 0n;
      }
    })
  );
  return raw;
}

function buildOutput({ balancesRaw, rpcUrl }) {
  const holders = TOP_HOLDING_ADDRESSES.map((holder, index) => {
    const balanceRaw = balancesRaw[index] ?? 0n;
    return {
      address: holder.address,
      label: holder.label,
      balanceRaw: balanceRaw.toString(),
      balance: ethers.formatUnits(balanceRaw, PRANA_DECIMALS),
    };
  }).sort((a, b) => {
    const aa = BigInt(a.balanceRaw);
    const bb = BigInt(b.balanceRaw);
    if (aa === bb) return a.address.localeCompare(b.address);
    return aa > bb ? -1 : 1;
  });

  return {
    generatedAt: new Date().toISOString(),
    rpcUrl: redactUrl(rpcUrl),
    token: {
      address: PRANA_ADDRESS,
      symbol: 'PRANA',
      decimals: PRANA_DECIMALS,
    },
    holders,
  };
}

export async function updateTopHoldingAddresses() {
  await loadDotEnvIntoProcessEnv();
  const rpcUrl = getRpcUrl();
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  let balancesRaw;
  let strategy = 'multicall';
  try {
    balancesRaw = await fetchBalancesViaMulticall(provider);
  } catch (error) {
    console.warn('Multicall failed, falling back to parallel balanceOf calls:', error);
    balancesRaw = await fetchBalancesViaFallback(provider);
    strategy = 'fallback';
  }

  const outputPath = path.join(PROJECT_ROOT, 'top_holding_addresses.json');
  const next = buildOutput({ balancesRaw, rpcUrl });
  const prev = await readJsonIfExists(outputPath);

  const previousHolders = JSON.stringify(prev?.holders ?? null);
  const nextHolders = JSON.stringify(next.holders);
  if (previousHolders === nextHolders) {
    return { updated: false, strategy };
  }

  await fs.writeFile(outputPath, JSON.stringify(next, null, 2), 'utf8');
  return { updated: true, strategy };
}

async function main() {
  const result = await updateTopHoldingAddresses();
  if (result?.updated) {
    console.log('Updated top_holding_addresses.json:', result);
  } else {
    console.log('No update needed:', result);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Failed to update top holding addresses JSON:', err);
    process.exitCode = 1;
  });
}

