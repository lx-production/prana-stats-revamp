import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { wagmiConfig } from './wagmiConfig.ts';

import type { ReactNode } from 'react';

// Module-scope client so remounting feature UI does not wipe Wagmi/TanStack Query cache.
const queryClient = new QueryClient();

type Web3ProvidersProps = {
  children: ReactNode;
};

/**
 * Shared Wagmi + React Query boundary for Swap and staking.
 * Order: WagmiProvider → QueryClientProvider → children (Wagmi 3.x needs both).
 */
export function Web3Providers({ children }: Web3ProvidersProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
