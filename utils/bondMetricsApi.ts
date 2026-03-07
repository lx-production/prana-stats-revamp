import type { BondMetricsApiResponse } from '../types/api.types';
import { fetchJson } from './fetchJson';

let cached: BondMetricsApiResponse | null = null;
let inFlight: Promise<BondMetricsApiResponse> | null = null;

export async function fetchBondMetricsApi(): Promise<BondMetricsApiResponse> {
  if (cached) return cached;

  if (!inFlight) {
    inFlight = fetchJson<BondMetricsApiResponse>('/api/bond-metrics')
      .then((result) => {
        cached = result;
        return result;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  return await inFlight;
}
