import { getPublicClient } from 'wagmi/actions';
import { wagmiConfig } from './wagmiConfig.ts';
import { waitForTransactionReceipt } from 'viem/actions';
import { POLYGON_CHAIN_ID } from '../../constants/network.ts';

import type { Hex } from '../../types/blockchain.types.ts';

/**
 * Wait for a Polygon receipt on the app's public RPC (dRPC via wagmi transport).
 * Shared by Swap, Staking, and Bonding — uses FRONTEND_POLYGON_RPC_URL, not the wallet provider.
 */
export async function waitForPolygonPublicReceipt(hash: Hex) {
  const publicClient = getPublicClient(wagmiConfig, { chainId: POLYGON_CHAIN_ID });
  if (!publicClient) {
    throw new Error('Polygon receipt RPC is unavailable.');
  }

  // Same cast pattern as the previous wallet-receipt helper: wagmi client generics
  // conflict with viem action generics even though the transport is compatible.
  return waitForTransactionReceipt(publicClient as never, { hash });
}
