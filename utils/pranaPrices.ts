import { fetchJson, fetchJsonSafe } from './fetchJson';
import type { PranaPricesBundle } from '../types';

const PRICES_CACHE_TTL_MS = 30_000; // 30 seconds
let cached: { value: PranaPricesBundle; timestamp: number } | null = null;
let inFlight: Promise<PranaPricesBundle> | null = null;

const fetchBtcPrices = async () => {
  const json = await fetchJson<any>('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,vnd');
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
      const [btcPrices, satsData, d30, d90, d180, d365] = await Promise.all([
        fetchBtcPrices(),
        fetchJsonSafe<any[]>('/data_sats.json', []),
        fetchJsonSafe<any[]>('/data_30_days.json', []),
        fetchJsonSafe<any[]>('/data_90_days.json', []),
        fetchJsonSafe<any[]>('/data_180_days.json', []),
        fetchJsonSafe<any[]>('/data_365_days.json', []),
      ]);

      const btcPriceUsd = btcPrices.usd;
      const btcPriceVnd = btcPrices.vnd;
      const usdToVndRate = btcPriceUsd === 0 ? 0 : btcPriceVnd / btcPriceUsd;

      // Fallback for sats data if missing (mock current price ~70 sats)
      const latestSatPrice = satsData.length > 0 ? satsData[satsData.length - 1].p : 70;

      const value: PranaPricesBundle = {
        btcPriceUsd,
        btcPriceVnd,
        usdToVndRate,
        latestSatPrice,
        satsData,
        d30,
        d90,
        d180,
        d365,
      };

      cached = { value, timestamp: Date.now() };
      return value;
    })().finally(() => {
      inFlight = null;
    });
  }

  return await inFlight;
}
