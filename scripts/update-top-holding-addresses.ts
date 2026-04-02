import { ethers } from 'ethers';
import { loadDotEnvIntoProcessEnv, getRpcUrl } from '../utils/bondsScanUtils.ts';
import { fetchBalancesViaMulticall, fetchBalancesViaFallback, buildOutput } from '../utils/topHoldingAddressesUpdater.ts';
import type { TopHoldingAddressesBuildOutput } from '../types.ts';
import type { TopHoldingAddressesUpdateStrategy } from './types/updateTopHoldingAddressesTypes.ts';

export async function loadTopHoldingAddresses(): Promise<TopHoldingAddressesBuildOutput> {
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

  if (strategy === 'fallback') {
    console.info('Loaded top holding addresses via fallback RPC calls.');
  }

  return buildOutput({ balancesRaw, rpcUrl });
}

async function main(): Promise<void> {
  const result = await loadTopHoldingAddresses();
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Failed to load top holding addresses:', err);
    process.exitCode = 1;
  });
}

