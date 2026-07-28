import { fetchJson } from '../../utils/fetchJson.ts';

import type { Address } from '../../types/blockchain.types.ts';
import type {
  BondingAccount,
  BondingConfig,
  BondingQuote,
  BondingQuoteRequest,
} from './bonding.types.ts';

/** Browser React Query key for GET /api/bonding/config. */
export const BONDING_CONFIG_QUERY_KEY = ['bonding-config'] as const;

/** Browser React Query key for GET /api/bonding/account?address=… */
export function bondingAccountQueryKey(address: Address) {
  return ['bonding-account', address] as const;
}

export async function fetchBondingConfig(): Promise<BondingConfig> {
  return await fetchJson<BondingConfig>('/api/bonding/config');
}

export async function fetchBondingAccount(
  address: Address,
): Promise<BondingAccount> {
  const url = `/api/bonding/account?address=${encodeURIComponent(address)}`;
  return await fetchJson<BondingAccount>(url);
}

/**
 * POST /api/bonding/quote — supports AbortSignal so the quote hook can cancel
 * in-flight requests when inputs change.
 */
export async function fetchBondingQuote(
  request: BondingQuoteRequest,
  signal?: AbortSignal,
): Promise<BondingQuote> {
  return await fetchJson<BondingQuote>(
    '/api/bonding/quote',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    },
    // Never dedupe POSTs — each quote body is unique.
    { dedupeKey: null },
  );
}
