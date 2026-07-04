import { useCallback } from 'react';
import { ProviderNotFoundError, useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { POLYGON_CHAIN_ID } from '../constants/swapContracts';
import type { HexAddress, UseInjectedWalletResult } from '../types/swap.types';
import type { Connector } from 'wagmi';

const NO_INJECTED_WALLET_MESSAGE =
  'No injected wallet was found. Please install MetaMask, Rabby, or another browser wallet.';

function isProviderNotFoundError(error: unknown): boolean {
  return (
    error instanceof ProviderNotFoundError ||
    (error instanceof Error && error.name === 'ProviderNotFoundError')
  );
}

async function hasProvider(connector: Connector): Promise<boolean> {
  try {
    return Boolean(await connector.getProvider());
  } catch {
    return false;
  }
}

async function getInjectedConnector(connectors: readonly Connector[]): Promise<Connector | null> {
  const orderedConnectors = [...connectors].sort((a, b) => {
    if (a.id === 'injected') return -1;
    if (b.id === 'injected') return 1;
    return 0;
  });

  for (const connector of orderedConnectors) {
    if (await hasProvider(connector)) return connector;
  }

  return null;
}

export function useInjectedWallet(): UseInjectedWalletResult {
  const { address, chainId, isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const connectWallet = useCallback(async () => {
    const connector = await getInjectedConnector(connectors);

    if (!connector) {
      throw new Error(NO_INJECTED_WALLET_MESSAGE);
    }

    try {
      await connectAsync({ connector });
    } catch (error) {
      if (isProviderNotFoundError(error)) {
        throw new Error(NO_INJECTED_WALLET_MESSAGE);
      }

      throw error;
    }
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
