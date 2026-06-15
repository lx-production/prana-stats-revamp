import { fetchJson } from './fetchJson';
import type { PricePoint } from '../types/pricePoint.ts';

export async function fetchPrana730Data(): Promise<PricePoint[]> {
  const json = await fetchJson<PricePoint[]>('/data_730_days.json');
  return Array.isArray(json) ? json : [];
}
