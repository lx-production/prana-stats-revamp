import SwapModal from './SwapModal.tsx';
import { Web3Providers } from '../web3/Web3Providers.tsx';

import type { SwapModalProps } from '../../types/swap.types.ts';

/**
 * Lazy composition root for Swap: Web3 boundary wraps the modal so wallet
 * hooks only run after this chunk loads.
 */
export default function SwapEntry(props: SwapModalProps) {
  return (
    <Web3Providers>
      <SwapModal {...props} />
    </Web3Providers>
  );
}
