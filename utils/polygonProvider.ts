import { ethers } from 'ethers';

const viteEnvPolygonRpcUrl =
  typeof import.meta !== 'undefined'
    ? (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_ALCHEMY_POLYGON_MAIN
    : undefined;

const envPolygonRpcUrl =
  viteEnvPolygonRpcUrl ||
  (typeof process !== 'undefined' ? process.env?.VITE_ALCHEMY_POLYGON_MAIN : undefined) ||
  null;

export const POLYGON_RPC_URL =
  envPolygonRpcUrl ||
  (typeof window !== 'undefined' ? (window as any).CONFIG?.POLYGON_RPC_URL : null) ||
  'https://polygon-rpc.com';

let providerSingleton: ethers.JsonRpcProvider | null = null;

export const getPolygonProvider = () => {
  if (providerSingleton) return providerSingleton;
  providerSingleton = new ethers.JsonRpcProvider(POLYGON_RPC_URL);
  return providerSingleton;
};


