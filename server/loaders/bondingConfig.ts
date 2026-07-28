import { ethers } from 'ethers';
import { getServerPolygonProvider } from '../utils/providers.ts';
import { POLYGON_CHAIN_ID } from '../../constants/network.ts';
import { isBondTermId, mapBondTermOption } from '../utils/bondingReadUtils.ts';
import { toBigInt } from '../../utils/fetchActiveStakesUtils.ts';
import {
  BUY_BOND_V2_ABI,
  SELL_BOND_V2_ABI,
  BUY_BOND_ADDRESS_V1,
  BUY_BOND_ADDRESS_V2,
  SELL_BOND_ADDRESS_V1,
  SELL_BOND_ADDRESS_V2,
  BUY_BOND_ACCOUNT_ABI,
  SELL_BOND_ACCOUNT_ABI,
} from '../../constants/bonds.ts';
import {
  PRANA_ADDRESS,
  WBTC_ADDRESS,
  PRANA_DECIMALS,
  WBTC_DECIMALS,
  WBTC_PRANA_V3_POOL,
} from '../../constants/sharedContracts.ts';

import type { BondTermId, BondingConfig } from '../../features/bonding/bonding.types.ts';

const BOND_TERM_IDS: readonly BondTermId[] = [0, 1, 2, 3, 4];

/**
 * Live chain read of bonding protocol config at a single blockTag.
 * Hard-fails on RPC/contract errors so the route can return 502.
 */
export async function loadBondingConfig(): Promise<BondingConfig> {
  const provider = await getServerPolygonProvider();
  const block = await provider.getBlock('latest');
  if (!block) {
    throw new Error('Failed to resolve latest block');
  }

  const blockTag = block.number;
  const buyV1 = new ethers.Contract(BUY_BOND_ADDRESS_V1, BUY_BOND_ACCOUNT_ABI, provider);
  const buyV2 = new ethers.Contract(BUY_BOND_ADDRESS_V2, BUY_BOND_V2_ABI, provider);
  const sellV1 = new ethers.Contract(SELL_BOND_ADDRESS_V1, SELL_BOND_ACCOUNT_ABI, provider);
  const sellV2 = new ethers.Contract(SELL_BOND_ADDRESS_V2, SELL_BOND_V2_ABI, provider);

  const [buyV1Paused, buyV2Paused, sellV1Paused, sellV2Paused, minBuy, minSell] =
    await Promise.all([
      buyV1.paused({ blockTag }),
      buyV2.paused({ blockTag }),
      sellV1.paused({ blockTag }),
      sellV2.paused({ blockTag }),
      buyV2.minPranaBuyAmount({ blockTag }),
      sellV2.minPranaSellAmount({ blockTag }),
    ]);

  // Read all five term slots for Buy + Sell V2 at the same block.
  const buyRateReads = BOND_TERM_IDS.map((termId) =>
    buyV2.bondRates(termId, { blockTag }),
  );
  const sellRateReads = BOND_TERM_IDS.map((termId) =>
    sellV2.bondRates(termId, { blockTag }),
  );
  const [buyRates, sellRates] = await Promise.all([
    Promise.all(buyRateReads),
    Promise.all(sellRateReads),
  ]);

  const buyTerms = BOND_TERM_IDS.map((termId, index) => {
    const row = buyRates[index] as { rate?: unknown; duration?: unknown } | unknown[];
    const rate = Array.isArray(row) ? row[0] : row.rate;
    const duration = Array.isArray(row) ? row[1] : row.duration;
    if (!isBondTermId(termId)) {
      throw new Error('Unexpected bond term id');
    }
    return mapBondTermOption(termId, rate, duration);
  });

  const sellTerms = BOND_TERM_IDS.map((termId, index) => {
    const row = sellRates[index] as { rate?: unknown; duration?: unknown } | unknown[];
    const rate = Array.isArray(row) ? row[0] : row.rate;
    const duration = Array.isArray(row) ? row[1] : row.duration;
    return mapBondTermOption(termId, rate, duration);
  });

  return {
    chainId: POLYGON_CHAIN_ID,
    blockNumber: block.number,
    blockTimestamp: block.timestamp,
    paused: {
      buyV1: Boolean(buyV1Paused),
      buyV2: Boolean(buyV2Paused),
      sellV1: Boolean(sellV1Paused),
      sellV2: Boolean(sellV2Paused),
    },
    minBuyPranaRaw: toBigInt(minBuy).toString(),
    minSellPranaRaw: toBigInt(minSell).toString(),
    buyTerms,
    sellTerms,
    contracts: {
      buyV1: BUY_BOND_ADDRESS_V1,
      buyV2: BUY_BOND_ADDRESS_V2,
      sellV1: SELL_BOND_ADDRESS_V1,
      sellV2: SELL_BOND_ADDRESS_V2,
      prana: PRANA_ADDRESS,
      wbtc: WBTC_ADDRESS,
      pool: WBTC_PRANA_V3_POOL,
    },
    pranaDecimals: PRANA_DECIMALS,
    wbtcDecimals: WBTC_DECIMALS,
  };
}
