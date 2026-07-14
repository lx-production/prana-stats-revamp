import { ethers } from 'ethers';
import { PROJECT_ROOT } from '../projectRoot.ts';
import { loadDotEnvIntoProcessEnv } from '../../utils/envUtils.ts';

const DEFAULT_POLYGON_RPC_URL = 'https://polygon-rpc.com';
const DEFAULT_ARBITRUM_RPC_URL = 'https://arb1.arbitrum.io/rpc';

let envLoadPromise: Promise<void> | null = null;
let polygonProvider: ethers.JsonRpcProvider | null = null;
let arbitrumProvider: ethers.JsonRpcProvider | null = null;

async function ensureServerEnvLoaded(): Promise<void> {
  if (!envLoadPromise) {
    envLoadPromise = loadDotEnvIntoProcessEnv(PROJECT_ROOT);
  }

  await envLoadPromise;
}

function getPolygonRpcUrl(): string {
  return process.env.VITE_ALCHEMY_POLYGON_MAIN || process.env.POLYGON_RPC_URL || DEFAULT_POLYGON_RPC_URL;
}

function getArbitrumRpcUrl(): string {
  return process.env.VITE_ALCHEMY_ARBITRUM_MAIN || process.env.ARBITRUM_RPC_URL || DEFAULT_ARBITRUM_RPC_URL;
}

// returns a cached ethers.JsonRpcProvider (ethers v6)
export async function getServerPolygonProvider(): Promise<ethers.JsonRpcProvider> {
  await ensureServerEnvLoaded();

  if (!polygonProvider) {
    polygonProvider = new ethers.JsonRpcProvider(getPolygonRpcUrl());
  }

  return polygonProvider;
}

// returns only the URL string
export async function getServerPolygonRpcUrl(): Promise<string> {
  await ensureServerEnvLoaded();
  return getPolygonRpcUrl();
}

export async function getServerArbitrumProvider(): Promise<ethers.JsonRpcProvider> {
  await ensureServerEnvLoaded();

  if (!arbitrumProvider) {
    arbitrumProvider = new ethers.JsonRpcProvider(getArbitrumRpcUrl());
  }

  return arbitrumProvider;
}
