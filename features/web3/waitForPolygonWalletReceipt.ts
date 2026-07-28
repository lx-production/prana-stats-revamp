import { waitForTransactionReceipt } from 'viem/actions';
import { getPolygonWalletClient } from './getPolygonWalletClient.ts';

import type { Hex } from '../../types/blockchain.types.ts';

/**
 * Wait through the connected wallet's Polygon RPC.
 * This keeps receipt polling on the same provider that broadcast the write.
 */
export async function waitForPolygonWalletReceipt(hash: Hex) {
  const walletClient = await getPolygonWalletClient();
  if (!walletClient) {
    throw new Error('Polygon wallet RPC unavailable');
  }

  // Wagmi's wallet-client generic conflicts with viem's action generic even
  // though both expose the same EIP-1193 request transport at runtime.
  return waitForTransactionReceipt(walletClient as never, { hash });
}
