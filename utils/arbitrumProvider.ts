import { ethers } from 'ethers';

const viteEnvArbitrumRpcUrl =
  typeof import.meta !== 'undefined'
    ? (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_ALCHEMY_ARBITRUM_MAIN
    : undefined;

const envArbitrumRpcUrl =
  viteEnvArbitrumRpcUrl ||
  (typeof process !== 'undefined' ? process.env?.VITE_ALCHEMY_ARBITRUM_MAIN : undefined) ||
  null;

export const ARBITRUM_RPC_URL =
  envArbitrumRpcUrl ||
  (typeof window !== 'undefined' ? (window as any).CONFIG?.ARBITRUM_RPC_URL : null) ||
  'https://arb1.arbitrum.io/rpc';

let providerSingleton: ethers.JsonRpcProvider | null = null;

export const getArbitrumProvider = () => {
  if (providerSingleton) return providerSingleton;
  providerSingleton = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
  return providerSingleton;
};
