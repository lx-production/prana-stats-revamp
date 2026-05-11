import type { BondingStatsInput, BondingStatsOutput } from '../types/types.ts';
import { formatBigIntValue, formatPranaDisplayFromRaw } from './bondingStatsHelpers.ts';
import { formatPranaFloatFromRaw } from './formatters.ts';

export const getBondingStats = ({
  buyCommittedV1,
  buyCommittedV2,
  buyBalanceV2,
  sellCommittedV1,
  sellCommittedV2,
  sellBalanceV2,
  buyBondTotalRawV2,
  sellBondTotalRawV2,
  buyBondTotalRawV1,
  sellBondTotalRawV1,
  pranaPriceVnd,
}: BondingStatsInput): BondingStatsOutput => {
  const buyBondProgressBaseRaw = buyBalanceV2 + buyCommittedV1; 
  const buyBondCommittedRaw = buyCommittedV1 + buyCommittedV2;
  const sellBondProgressBaseRaw = sellBalanceV2 + sellCommittedV1;
  const sellBondCommittedRaw = sellCommittedV1 + sellCommittedV2;

  const buyBondCapacityRaw = buyBondProgressBaseRaw > buyBondCommittedRaw ? buyBondProgressBaseRaw - buyBondCommittedRaw : 0n;  
  const buyBondCommittedPercent = buyBondProgressBaseRaw === 0n ? 0 : Number((buyBondCommittedRaw * 10_000n) / buyBondProgressBaseRaw) / 100;
  const buyBondCapacityPercent = Math.max(0, 100 - buyBondCommittedPercent);
  const sellBondCapacityRaw = sellBondProgressBaseRaw > sellBondCommittedRaw ? sellBondProgressBaseRaw - sellBondCommittedRaw : 0n;  
  const sellBondCommittedPercent = sellBondProgressBaseRaw === 0n ? 0 : Number((sellBondCommittedRaw * 10_000n) / sellBondProgressBaseRaw) / 100;
  const sellBondCapacityPercent = Math.max(0, 100 - sellBondCommittedPercent);
  
  const totalBuyBondRaw = buyBondTotalRawV2 + buyBondTotalRawV1;
  const totalSellBondRaw = sellBondTotalRawV2 + sellBondTotalRawV1;
  const buyBondPranaVal = formatPranaFloatFromRaw(totalBuyBondRaw) || 150000;
  const sellBondPranaVal = formatPranaFloatFromRaw(totalSellBondRaw) || 335000;

  return {
    buyBondPrana: buyBondPranaVal,
    buyBondVnd: buyBondPranaVal * pranaPriceVnd,
    sellBondPrana: sellBondPranaVal,
    sellBondVnd: sellBondPranaVal * pranaPriceVnd,
    buyBondProgressBaseDisplay: formatPranaDisplayFromRaw(buyBondProgressBaseRaw),
    buyBondCommittedDisplay: formatPranaDisplayFromRaw(buyBondCommittedRaw),
    buyBondCapacityDisplay: formatPranaDisplayFromRaw(buyBondCapacityRaw),
    buyBondCommittedPercent,
    buyBondCapacityPercent,
    sellBondProgressBaseDisplay: formatBigIntValue(sellBondProgressBaseRaw),
    sellBondCommittedDisplay: formatBigIntValue(sellBondCommittedRaw),
    sellBondCapacityDisplay: formatBigIntValue(sellBondCapacityRaw),
    sellBondCommittedPercent,
    sellBondCapacityPercent,
  };
};
