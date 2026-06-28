import { useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { POLYGON_CHAIN_ID } from '../constants/swapContracts';
import type { HexAddress, UseInjectedWalletResult } from '../types/swap.types';

export function useInjectedWallet(): UseInjectedWalletResult {
  const { address, chainId, isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const connectWallet = useCallback(async () => {
    const connector = connectors.find((item) => item.id === 'injected') ?? connectors[0];

    if (!connector) {
      throw new Error('No injected wallet was found. Please install MetaMask or another browser wallet.');
    }

    await connectAsync({ connector });
  }, [connectAsync, connectors]);

  const ensurePolygon = useCallback(async () => {
    if (chainId === POLYGON_CHAIN_ID) return true;

    await switchChainAsync({ chainId: POLYGON_CHAIN_ID });
    return true;
  }, [chainId, switchChainAsync]);

  return {
    address: address as HexAddress | undefined,
    chainId,
    isConnected,
    isConnecting: isPending,
    isPolygon: chainId === POLYGON_CHAIN_ID,
    connectWallet,
    disconnectWallet: disconnect,
    ensurePolygon,
  };
}
