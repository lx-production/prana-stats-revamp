import fs from 'node:fs/promises';
import path from 'node:path';
import { ethers } from 'ethers';
import { readJsonIfExists } from '../utils/jsonHelper.ts';
import { loadDotEnvIntoProcessEnv, getRpcUrl, PROJECT_ROOT } from '../utils/bondsScanUtils.ts';
import { clampTopHoldingAddressesPage, getTopHoldingAddressesPage } from '../utils/topHoldingAddressesPagination.ts';
import { fetchBalancesViaMulticall, fetchBalancesViaFallback, buildOutput, mergeTopHoldingAddressesPage } from '../utils/topHoldingAddressesUpdater.ts';
import type { TopHoldingAddressesBuildOutput } from '../types.ts';
import type { TopHoldingAddressesUpdateStrategy, UpdateTopHoldingAddressesResult } from './types/updateTopHoldingAddressesTypes.ts';

export async function updateTopHoldingAddresses(page = 1): Promise<UpdateTopHoldingAddressesResult> {
  await loadDotEnvIntoProcessEnv();
  const rpcUrl = getRpcUrl();
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const currentPage = clampTopHoldingAddressesPage(page);
  const targetHolders = getTopHoldingAddressesPage(currentPage);

  let balancesRaw: bigint[];
  let strategy: TopHoldingAddressesUpdateStrategy = 'multicall';
  try {
    balancesRaw = await fetchBalancesViaMulticall(provider, targetHolders);
  } catch (error) {
    console.warn('Multicall failed, falling back to parallel balanceOf calls:', error);
    balancesRaw = await fetchBalancesViaFallback(provider, targetHolders);
    strategy = 'fallback';
  }

  const outputPath = path.join(PROJECT_ROOT, 'top_holding_addresses.json');
  const prev = await readJsonIfExists<TopHoldingAddressesBuildOutput>(outputPath);
  const nextPage = buildOutput({ balancesRaw, rpcUrl, holders: targetHolders });
  const next: TopHoldingAddressesBuildOutput = {
    ...nextPage,
    holders: mergeTopHoldingAddressesPage({
      page: currentPage,
      pageHolders: nextPage.holders,
      previousHolders: prev?.holders,
    }),
  };

  const previousHolders = JSON.stringify(prev?.holders ?? null);
  const nextHolders = JSON.stringify(next.holders);
  if (previousHolders === nextHolders) {
    return { updated: false, strategy };
  }

  await fs.writeFile(outputPath, JSON.stringify(next, null, 2), 'utf8');
  return { updated: true, strategy };
}

async function main(): Promise<void> {
  const pageArg = Number(process.argv[2] ?? '1');
  const result = await updateTopHoldingAddresses(pageArg);
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

