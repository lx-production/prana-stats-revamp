import { fetchJson } from './fetchJson';
import type { PranaPricesBundle } from '../types';

const PRICES_CACHE_TTL_MS = 15_000;
let cached: { value: PranaPricesBundle; timestamp: number } | null = null;
let inFlight: Promise<PranaPricesBundle> | null = null;

const fetchJsonSafe = async <T,>(url: string, fallback: T): Promise<T> => {
  try {
    return await fetchJson<T>(url);
  } catch (e) {
    console.warn(`Failed to fetch ${url}`, e);
    return fallback;
  }
};

const fetchBtcPrices = async () => {
  const json = await fetchJson<any>(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,vnd',
  );
  const usd = json?.bitcoin?.usd;
  const vnd = json?.bitcoin?.vnd;
  if (typeof usd !== 'number' || !Number.isFinite(usd)) {
    throw new Error('Failed to fetch BTC price USD (CoinGecko): invalid response');
  }
  if (typeof vnd !== 'number' || !Number.isFinite(vnd)) {
    throw new Error('Failed to fetch BTC price VND (CoinGecko): invalid response');
  }
  return { usd, vnd };
};

export async function fetchPranaPricesBundle(): Promise<PranaPricesBundle> {
  const now = Date.now();
  if (cached && now - cached.timestamp < PRICES_CACHE_TTL_MS) return cached.value;

  if (!inFlight) {
    inFlight = (async () => {
      const [btcPrices, satsDataRes, d30, d90, d180, d365, bondsV2Json] = await Promise.all([
        fetchBtcPrices(),
        fetchJsonSafe<any[]>('/data_sats.json', []),
        fetchJsonSafe<any[]>('/data_30_days.json', []),
        fetchJsonSafe<any[]>('/data_90_days.json', []),
        fetchJsonSafe<any[]>('/data_180_days.json', []),
        fetchJsonSafe<any[]>('/data_365_days.json', []),
        fetchJsonSafe<unknown>('/bonds_v2.json', null),
      ]);

      const btcPriceUsd = btcPrices.usd;
      const btcPriceVnd = btcPrices.vnd;
      const usdToVndRate = btcPriceUsd === 0 ? 0 : btcPriceVnd / btcPriceUsd;

      // Fallback for sats data if missing (mock current price ~60 sats)
      const latestSatPrice = satsDataRes.length > 0 ? satsDataRes[satsDataRes.length - 1].p : 60;

      const value: PranaPricesBundle = {
        btcPriceUsd,
        btcPriceVnd,
        usdToVndRate,
        latestSatPrice,
        d30,
        d90,
        d180,
        d365,
        bondsV2Json,
      };

      cached = { value, timestamp: Date.now() };
      return value;
    })().finally(() => {
      inFlight = null;
    });
  }

  return await inFlight;
}

