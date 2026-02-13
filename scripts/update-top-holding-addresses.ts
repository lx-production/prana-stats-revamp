import fs from 'node:fs/promises';
import path from 'node:path';
import { ethers } from 'ethers';
import { readJsonIfExists } from '../utils/jsonHelper.ts';
import { loadDotEnvIntoProcessEnv, getRpcUrl, PROJECT_ROOT } from '../utils/bondsScanUtils.ts';
import { fetchBalancesViaMulticall, fetchBalancesViaFallback, buildOutput } from '../utils/topHoldingAddressesUpdater.ts';
import type { TopHoldingAddressesBuildOutput } from '../types.ts';
import type {
  TopHoldingAddressesUpdateStrategy,
  UpdateTopHoldingAddressesResult,
} from './types/updateTopHoldingAddressesTypes.ts';

export async function updateTopHoldingAddresses(): Promise<UpdateTopHoldingAddressesResult> {
  await loadDotEnvIntoProcessEnv();
  const rpcUrl = getRpcUrl();
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  let balancesRaw: bigint[];
  let strategy: TopHoldingAddressesUpdateStrategy = 'multicall';
  try {
    balancesRaw = await fetchBalancesViaMulticall(provider);
  } catch (error) {
    console.warn('Multicall failed, falling back to parallel balanceOf calls:', error);
    balancesRaw = await fetchBalancesViaFallback(provider);
    strategy = 'fallback';
  }

  const outputPath = path.join(PROJECT_ROOT, 'top_holding_addresses.json');
  const next = buildOutput({ balancesRaw, rpcUrl });
  const prev = await readJsonIfExists<TopHoldingAddressesBuildOutput>(outputPath);

  const previousHolders = JSON.stringify(prev?.holders ?? null);
  const nextHolders = JSON.stringify(next.holders);
  if (previousHolders === nextHolders) {
    return { updated: false, strategy };
  }

  await fs.writeFile(outputPath, JSON.stringify(next, null, 2), 'utf8');
  return { updated: true, strategy };
}

async function main(): Promise<void> {
  const result = await updateTopHoldingAddresses();
  if (result.updated) {
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

