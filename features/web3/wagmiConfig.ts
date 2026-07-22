import { polygon } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { createConfig, http } from 'wagmi';
import { FRONTEND_POLYGON_RPC_URL } from '../../constants/network.ts';

export const wagmiConfig = createConfig({
  chains: [polygon],
  connectors: [injected()],
  transports: {
    [polygon.id]: http(FRONTEND_POLYGON_RPC_URL),
  },
});
