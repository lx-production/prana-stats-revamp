import BondingPage from '../../pages/BondingPage.tsx';
import { Web3Providers } from '../web3/Web3Providers.tsx';

/**
 * Lazy composition root for /bond/: Web3 boundary wraps the page so Wagmi
 * and React Query only load with this route chunk.
 */
export default function BondingEntry() {
  return (
    <Web3Providers>
      <BondingPage />
    </Web3Providers>
  );
}
