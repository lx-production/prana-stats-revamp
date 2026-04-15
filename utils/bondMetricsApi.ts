import { fetchJson } from './fetchJson.ts';
import type { BondMetricsApiResponse } from '../types/api.types';

export async function fetchBondMetricsApi(opts: { force?: boolean } = {}): Promise<BondMetricsApiResponse> {
  return await fetchJson<BondMetricsApiResponse>('/api/bond-metrics', undefined, {
    dedupeKey: opts.force ? null : undefined,
  });
}
