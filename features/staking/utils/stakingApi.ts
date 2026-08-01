import { fetchJson } from '../../../utils/fetchJson.ts';

import type { Address } from '../../../types/blockchain.types.ts';
import type { StakingAccountSnapshot, StakingConfig, StakingQuote, StakingQuoteRequest, StakingTransactionConfirmation, StakingTransactionConfirmationRequest } from '../staking.types.ts';

/** Browser React Query key for GET /api/staking/config. */
export const STAKING_CONFIG_QUERY_KEY = ['staking-config'] as const;

/** Browser React Query key for GET /api/staking/account?address=… */
export function stakingAccountQueryKey(address: Address) {
  return ['staking-account', address] as const;
}

export async function fetchStakingConfig(): Promise<StakingConfig> {
  return await fetchJson<StakingConfig>('/api/staking/config');
}

export async function fetchStakingAccount(
  address: Address,
): Promise<StakingAccountSnapshot> {
  const url = `/api/staking/account?address=${encodeURIComponent(address)}`;
  return await fetchJson<StakingAccountSnapshot>(url);
}

/**
 * POST /api/staking/quote — AbortSignal so the quote hook can cancel in-flight
 * requests when amount/duration changes. Never dedupe POSTs.
 */
export async function fetchStakingQuote(
  request: StakingQuoteRequest,
  signal?: AbortSignal,
): Promise<StakingQuote> {
  return await fetchJson<StakingQuote>(
    '/api/staking/quote',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    },
    { dedupeKey: null },
  );
}

/**
 * POST /api/staking/confirm-transaction — server Polygon RPC fallback when the
 * browser cannot read a receipt for an already-broadcast hash.
 */
export async function confirmStakingTransactionOnServer(
  request: StakingTransactionConfirmationRequest,
): Promise<StakingTransactionConfirmation> {
  return await fetchJson<StakingTransactionConfirmation>(
    '/api/staking/confirm-transaction',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
    { dedupeKey: null },
  );
}
