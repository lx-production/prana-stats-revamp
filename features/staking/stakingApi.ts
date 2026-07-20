import { fetchJson } from '../../utils/fetchJson.ts';

import type { Address } from '../../types/blockchain.types.ts';
import type { StakingAccountSnapshot, StakingConfig } from './staking.types.ts';

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
