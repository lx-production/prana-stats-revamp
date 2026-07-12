import { useCallback } from 'react';
import { POLYGON_CHAIN_ID } from '../constants/swapContracts';
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain, ProviderNotFoundError } from 'wagmi';

import type { Connector } from 'wagmi';
import type { HexAddress, UseInjectedWalletResult } from '../types/swap.types';

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
  const connect = useConnect();
  const disconnect = useDisconnect();
  const connectors = useConnectors();
  const switchChain = useSwitchChain();
  const { address, chainId, isConnected } = useConnection();

  const connectWallet = useCallback(async () => {
    const connector = await getInjectedConnector(connectors);

    if (!connector) {
      throw new Error(NO_INJECTED_WALLET_MESSAGE);
    }

    try {
      // wagmi v3: connectAsync was renamed to mutateAsync
      await connect.mutateAsync({ connector });
    } catch (error) {
      if (isProviderNotFoundError(error)) {
        throw new Error(NO_INJECTED_WALLET_MESSAGE);
      }

      throw error;
    }
  }, [connect.mutateAsync, connectors]);

  const ensurePolygon = useCallback(async () => {
    if (chainId === POLYGON_CHAIN_ID) return true;

    // wagmi v3: switchChainAsync was renamed to mutateAsync
    await switchChain.mutateAsync({ chainId: POLYGON_CHAIN_ID });
    return true;
  }, [chainId, switchChain.mutateAsync]);

  return {
    address: address as HexAddress | undefined,
    chainId,
    isConnected,
    isConnecting: connect.isPending,
    isPolygon: chainId === POLYGON_CHAIN_ID,
    connectWallet,
    // wagmi v3: disconnect was renamed to mutate
    disconnectWallet: () => {
      disconnect.mutate();
    },
    ensurePolygon,
  };
}
