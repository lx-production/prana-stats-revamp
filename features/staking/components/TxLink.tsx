import { ExternalLink } from 'lucide-react';
import { POLYGONSCAN_TX_BASE_URL } from '../../../constants/network.ts';

import type { Hex } from '../../../types/blockchain.types.ts';

/** Compact Polygonscan deep link for a transaction hash. */
export default function TxLink({ hash, label }: { hash: Hex; label: string }) {
  return (
    <a
      href={`${POLYGONSCAN_TX_BASE_URL}/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 break-all text-cyan-300 underline-offset-2 hover:underline"
    >
      {label}
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
    </a>
  );
}
