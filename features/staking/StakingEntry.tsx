import StakingPage from '../../pages/StakingPage.tsx';
import { Web3Providers } from '../web3/Web3Providers.tsx';

/**
 * Lazy composition root for /stake/: Web3 boundary wraps the page so Wagmi
 * and React Query only load with this route chunk.
 */
export default function StakingEntry() {
  return (
    <Web3Providers>
      <StakingPage />
    </Web3Providers>
  );
}
