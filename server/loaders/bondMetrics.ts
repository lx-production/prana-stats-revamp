import path from 'node:path';
import type { BondMetricsApiResponse } from '../../types/api.types.ts';
import type { BondsV2Json } from '../../types.ts';
import { ethers } from 'ethers';
import { getBondingStats } from '../../utils/bondingStats.ts';
import { readJsonIfExists } from '../../utils/jsonHelper.ts';
import { getTotalsFromBondsV2Json } from '../../utils/bondsV2Json.ts';
import { getServerPolygonProvider } from '../utils/providers.ts';
import { PROJECT_ROOT } from '../projectRoot.ts';
import { loadPranaPricesBundle } from './pranaPrices.ts';
import { MINIMAL_ERC20_ABI, PRANA_ADDRESS, PRANA_DECIMALS, WBTC_ADDRESS } from '../../constants/sharedContracts.ts';
import {
  BUY_BOND_ADDRESS_V1,
  BUY_BOND_ADDRESS_V2,
  SELL_BOND_ADDRESS_V1,
  SELL_BOND_ADDRESS_V2,
  BUY_BOND_COMMITTED_PRANA_ABI,
  SELL_BOND_COMMITTED_WBTC_ABI,
} from '../../constants/bonds.ts';

export const BUY_BOND_V1_TOTAL_VOLUME_RAW = ethers.parseUnits('145235', PRANA_DECIMALS);
export const SELL_BOND_V1_TOTAL_VOLUME_RAW = ethers.parseUnits('194235', PRANA_DECIMALS);

export interface BondSnapshot {
  buyCommittedV1: bigint;
  buyCommittedV2: bigint;
  buyBalanceV2: bigint;
  sellCommittedV1: bigint;
  sellCommittedV2: bigint;
  sellBalanceV2: bigint;
  buyBondTotalRawV2: bigint;
  sellBondTotalRawV2: bigint;
}

async function loadBondsV2Totals(): Promise<{ buyBondTotalRawV2: bigint; sellBondTotalRawV2: bigint }> {
  const fullPath = path.join(PROJECT_ROOT, 'bonds_v2.json');
  const data = await readJsonIfExists<BondsV2Json>(fullPath);
  return getTotalsFromBondsV2Json(data);
}

function toBigInt(value: unknown): bigint {
  return typeof value === 'bigint' ? value : BigInt((value as { toString?: () => string } | null)?.toString?.() ?? '0');
}

async function safeContractCall(call: Promise<unknown>, fallback: bigint): Promise<bigint> {
  try {
    return toBigInt(await call);
  } catch {
    return fallback;
  }
}

export async function loadBondSnapshot(): Promise<BondSnapshot> {
  const provider = await getServerPolygonProvider();
  const tokenContract = new ethers.Contract(PRANA_ADDRESS, MINIMAL_ERC20_ABI, provider);
  const wbtcTokenContract = new ethers.Contract(WBTC_ADDRESS, MINIMAL_ERC20_ABI, provider);
  const buyBondV1Contract = new ethers.Contract(BUY_BOND_ADDRESS_V1, BUY_BOND_COMMITTED_PRANA_ABI, provider);
  const buyBondV2Contract = new ethers.Contract(BUY_BOND_ADDRESS_V2, BUY_BOND_COMMITTED_PRANA_ABI, provider);
  const sellBondV1Contract = new ethers.Contract(SELL_BOND_ADDRESS_V1, SELL_BOND_COMMITTED_WBTC_ABI, provider);
  const sellBondV2Contract = new ethers.Contract(SELL_BOND_ADDRESS_V2, SELL_BOND_COMMITTED_WBTC_ABI, provider);

  const [buyCommittedV2, buyCommittedV1, buyBalanceV2, sellCommittedV2, sellCommittedV1, sellBalanceV2, bondsV2Totals] =
    await Promise.all([
      safeContractCall(buyBondV2Contract.committedPrana(), 0n),
      safeContractCall(buyBondV1Contract.committedPrana(), 0n),
      safeContractCall(tokenContract.balanceOf(BUY_BOND_ADDRESS_V2), 0n),
      safeContractCall(sellBondV2Contract.committedWbtc(), 0n),
      safeContractCall(sellBondV1Contract.committedWbtc(), 0n),
      safeContractCall(wbtcTokenContract.balanceOf(SELL_BOND_ADDRESS_V2), 0n),
      loadBondsV2Totals(),
    ]);

  return {
    buyCommittedV1,
    buyCommittedV2,
    buyBalanceV2,
    sellCommittedV1,
    sellCommittedV2,
    sellBalanceV2,
    buyBondTotalRawV2: bondsV2Totals.buyBondTotalRawV2,
    sellBondTotalRawV2: bondsV2Totals.sellBondTotalRawV2,
  };
}

export async function loadBondMetrics(): Promise<BondMetricsApiResponse> {
  const [snapshot, { btcPriceVnd, latestSatPrice }] = await Promise.all([
    loadBondSnapshot(),
    loadPranaPricesBundle(),
  ]);

  const pranaPriceVnd = (latestSatPrice / 1e8) * btcPriceVnd;

  const buyTotalBalanceRaw = snapshot.buyBalanceV2 + snapshot.buyCommittedV1;
  const buyTotalCommittedRaw = snapshot.buyCommittedV1 + snapshot.buyCommittedV2;
  const buyTotalVolumeRaw = snapshot.buyBondTotalRawV2 + BUY_BOND_V1_TOTAL_VOLUME_RAW;

  const sellTotalBalanceRaw = snapshot.sellBalanceV2 + snapshot.sellCommittedV1;
  const sellTotalCommittedRaw = snapshot.sellCommittedV1 + snapshot.sellCommittedV2;
  const sellTotalVolumeRaw = snapshot.sellBondTotalRawV2 + SELL_BOND_V1_TOTAL_VOLUME_RAW;

  const summary = getBondingStats({
    buyCommittedV1: snapshot.buyCommittedV1,
    buyCommittedV2: snapshot.buyCommittedV2,
    buyBalanceV2: snapshot.buyBalanceV2,
    sellCommittedV1: snapshot.sellCommittedV1,
    sellCommittedV2: snapshot.sellCommittedV2,
    sellBalanceV2: snapshot.sellBalanceV2,
    buyBondTotalRawV2: snapshot.buyBondTotalRawV2,
    sellBondTotalRawV2: snapshot.sellBondTotalRawV2,
    buyBondTotalRawV1: BUY_BOND_V1_TOTAL_VOLUME_RAW,
    sellBondTotalRawV1: SELL_BOND_V1_TOTAL_VOLUME_RAW,
    pranaPriceVnd,
  });

  return {
    buy: {
      v1CommittedRaw: snapshot.buyCommittedV1.toString(),
      v2CommittedRaw: snapshot.buyCommittedV2.toString(),
      v2BalanceRaw: snapshot.buyBalanceV2.toString(),
      totalBalanceRaw: buyTotalBalanceRaw.toString(),
      totalCommittedRaw: buyTotalCommittedRaw.toString(),
      totalVolumeRaw: buyTotalVolumeRaw.toString(),
    },
    sell: {
      v1CommittedRaw: snapshot.sellCommittedV1.toString(),
      v2CommittedRaw: snapshot.sellCommittedV2.toString(),
      v2BalanceRaw: snapshot.sellBalanceV2.toString(),
      totalBalanceRaw: sellTotalBalanceRaw.toString(),
      totalCommittedRaw: sellTotalCommittedRaw.toString(),
      totalVolumeRaw: sellTotalVolumeRaw.toString(),
    },
    summary,
  };
}
