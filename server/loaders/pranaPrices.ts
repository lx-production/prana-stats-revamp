import path from 'node:path';
import { readJsonIfExists } from '../../utils/jsonHelper.ts';
import type { PranaPricesBundle } from '../../types.ts';
import { fetchJson } from '../../utils/fetchJson.ts';
import { PROJECT_ROOT } from '../projectRoot.ts';

const PRICES_CACHE_TTL_MS = 30_000;

let cached: { value: PranaPricesBundle; timestamp: number } | null = null;
let inFlight: Promise<PranaPricesBundle> | null = null;

async function fetchBtcPrices() {
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
}

async function readRootJsonArray(filename: string): Promise<any[]> {
  const fullPath = path.join(PROJECT_ROOT, filename);
  const data = await readJsonIfExists<any[]>(fullPath);
  return Array.isArray(data) ? data : [];
}

export async function loadPranaPricesBundle(): Promise<PranaPricesBundle> {
  const now = Date.now();
  if (cached && now - cached.timestamp < PRICES_CACHE_TTL_MS) {
    return cached.value;
  }

  if (!inFlight) {
    inFlight = (async () => {
      const [btcPrices, satsData, d30, d90, d180, d365] = await Promise.all([
        fetchBtcPrices(),
        readRootJsonArray('data_sats.json'),
        readRootJsonArray('data_30_days.json'),
        readRootJsonArray('data_90_days.json'),
        readRootJsonArray('data_180_days.json'),
        readRootJsonArray('data_365_days.json'),
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
