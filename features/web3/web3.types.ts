import type { HexAddress } from '../../types/blockchain.types.ts';

/** Result of the shared injected-wallet hook (Swap + staking). */
export type UseInjectedWalletResult = {
  address?: HexAddress;
  chainId?: number;
  isConnected: boolean;
  isConnecting: boolean;
  isPolygon: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  ensurePolygon: () => Promise<boolean>;
};
