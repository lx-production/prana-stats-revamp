import { fetchJson } from './fetchJson';
import type { PricePoint } from '../types/pricePoint.ts';

export async function fetchPranaSatsData(): Promise<PricePoint[]> {
  const json = await fetchJson<PricePoint[]>('/data_sats.json');
  return Array.isArray(json) ? json : [];
}
