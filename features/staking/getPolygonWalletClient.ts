import { getWalletClient } from 'wagmi/actions';
import { POLYGON_CHAIN_ID } from '../../constants/network.ts';
import { wagmiConfig } from '../../utils/wagmiConfig.ts';

/**
 * Resolve a fresh Polygon wallet client after ensurePolygon().
 * Do not reuse a walletClient captured from a pre-switch render.
 */
export async function getPolygonWalletClient() {
  return getWalletClient(wagmiConfig, { chainId: POLYGON_CHAIN_ID });
}
