import { fetchJson } from './fetchJson.ts';

import type { BondMetricsApiResponse } from '../types/api.types';

// Browser relies on HTTP Cache-Control (24h) + fetchJson GET dedupe; no in-memory TTL layer.
export async function fetchBondMetricsApi(): Promise<BondMetricsApiResponse> {
  return await fetchJson<BondMetricsApiResponse>('/api/bond-metrics');
}
