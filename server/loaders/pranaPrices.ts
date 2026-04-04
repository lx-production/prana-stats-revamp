import path from 'node:path';
import { readJsonIfExists } from '../../utils/jsonHelper.ts';
import { fetchJson, fetchJsonSafe } from '../../utils/fetchJson.ts';
import { PROJECT_ROOT } from '../projectRoot.ts';
import { CACHE_TTL_MS } from '../../constants/cachePolicy.js';
import type { PranaPricesBundle } from '../../types.ts';
import type { PricePoint } from '../../types/pricePoint.ts';

const USD_TO_VND_FALLBACK = 27_000;

let cached: { value: PranaPricesBundle; timestamp: number } | null = null;
let inFlight: Promise<PranaPricesBundle> | null = null;

async function fetchBtcPrices() {
  try {
    const json = await fetchJson<{ bitcoin?: { usd?: number; vnd?: number } }>(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,vnd'
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
  } catch (error) {
    const [binanceJson, exchangeRateJson] = await Promise.all([
      fetchJsonSafe<{ price?: string }>('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', {}),
      fetchJsonSafe<{ rates?: { VND?: number } }>('https://api.exchangerate-api.com/v4/latest/USD', {}),
    ]);
    const fallbackUsd = Number(binanceJson?.price);
    const fallbackRate = exchangeRateJson?.rates?.VND;

    if (Number.isFinite(fallbackUsd) && typeof fallbackRate === 'number' && Number.isFinite(fallbackRate) && fallbackRate > 0) {
      console.warn('CoinGecko rate limited or unavailable, using Binance BTC price fallback.', error);
      return {
        usd: fallbackUsd,
        vnd: fallbackUsd * fallbackRate,
      };
    }

    if (Number.isFinite(fallbackUsd)) {
      console.warn('CoinGecko rate limited or unavailable, using Binance BTC price with fallback USD/VND rate.', error);
      return {
        usd: fallbackUsd,
        vnd: fallbackUsd * USD_TO_VND_FALLBACK,
      };
    }

    if (cached) {
      console.warn('CoinGecko rate limited or unavailable, using stale cached BTC prices.', error);
      return {
        usd: cached.value.btcPriceUsd,
        vnd: cached.value.btcPriceVnd,
      };
    }

    throw error;
  }
}

async function readPricePointSeries(filename: string): Promise<PricePoint[]> {
  const fullPath = path.join(PROJECT_ROOT, filename);
  const data = await readJsonIfExists<unknown>(fullPath);
  return (Array.isArray(data) ? data : []) as PricePoint[];
}

export async function loadPranaPricesBundle(): Promise<PranaPricesBundle> {
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL_MS.apiResponse) {
    return cached.value;
  }

  if (!inFlight) {
    inFlight = (async () => {
      const [btcPrices, satsData, d365] = await Promise.all([
        fetchBtcPrices(),
        readPricePointSeries('data_sats.json'),
        readPricePointSeries('data_365_days.json'),
      ]);

      const btcPriceUsd = btcPrices.usd;
      const btcPriceVnd = btcPrices.vnd;
      const usdToVndRate = btcPriceUsd === 0 ? 0 : btcPriceVnd / btcPriceUsd;
      const latestSatPrice = satsData.length > 0 ? satsData[satsData.length - 1].p : 70;

      const value: PranaPricesBundle = {
        btcPriceUsd,
        btcPriceVnd,
        usdToVndRate,
        latestSatPrice,
        satsData,
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
