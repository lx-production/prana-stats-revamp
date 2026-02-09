import { ethers } from 'ethers';
import { PRANA_DECIMALS } from '../constants/sharedContracts';
import { BondingStatsInput, BondingStatsOutput } from '../types';

const formatBigIntValue = (value: bigint) => {
  const stringValue = value.toString();
  return stringValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const formatPranaDisplayFromRaw = (raw: bigint) => {
  const formatted = ethers.formatUnits(raw, PRANA_DECIMALS);
  const numeric = Number.parseFloat(formatted);
  const rounded = Number.isFinite(numeric) ? Math.round(numeric) : 0;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(rounded);
};

const formatPranaFloatFromRaw = (val: bigint) => parseFloat(ethers.formatUnits(val, PRANA_DECIMALS));

export const getBondingStats = ({
  buyCommittedV1,
  buyCommittedV2,
  buyBalanceV2,
  sellCommittedV1,
  sellCommittedV2,
  sellBalanceV2,
  buyBondTotalRawV2,
  sellBondTotalRawV2,
  buyBondV1TotalRaw,
  sellBondV1TotalRaw,
  pranaPriceVnd,
}: BondingStatsInput): BondingStatsOutput => {
  const buyBondBalanceRaw = buyBalanceV2 + buyCommittedV1;
  const buyBondCommittedRaw = buyCommittedV1 + buyCommittedV2;
  const sellBondBalanceRaw = sellBalanceV2 + sellCommittedV1;
  const sellBondCommittedRaw = sellCommittedV1 + sellCommittedV2;

  const buyBondCapacityRaw = buyBondBalanceRaw > buyBondCommittedRaw ? buyBondBalanceRaw - buyBondCommittedRaw : 0n;
  const buyBondCommittedPercent =
    buyBondBalanceRaw === 0n
      ? 0
      : Number((buyBondCommittedRaw * 10_000n) / buyBondBalanceRaw) / 100;
  const buyBondCapacityPercent = Math.max(0, 100 - buyBondCommittedPercent);

  const sellBondCapacityRaw = sellBondBalanceRaw > sellBondCommittedRaw ? sellBondBalanceRaw - sellBondCommittedRaw : 0n;
  const sellBondCommittedPercent =
    sellBondBalanceRaw === 0n
      ? 0
      : Number((sellBondCommittedRaw * 10_000n) / sellBondBalanceRaw) / 100;
  const sellBondCapacityPercent = Math.max(0, 100 - sellBondCommittedPercent);

  const totalBuyBondRaw = buyBondTotalRawV2 + buyBondV1TotalRaw;
  const totalSellBondRaw = sellBondTotalRawV2 + sellBondV1TotalRaw;

  const buyBondPranaVal = formatPranaFloatFromRaw(totalBuyBondRaw) || 150000;
  const sellBondPranaVal = formatPranaFloatFromRaw(totalSellBondRaw) || 335000;

  return {
    buyBondPrana: buyBondPranaVal,
    buyBondVnd: buyBondPranaVal * pranaPriceVnd,
    sellBondPrana: sellBondPranaVal,
    sellBondVnd: sellBondPranaVal * pranaPriceVnd,
    buyBondBalanceDisplay: formatPranaDisplayFromRaw(buyBondBalanceRaw),
    buyBondCommittedDisplay: formatPranaDisplayFromRaw(buyBondCommittedRaw),
    buyBondCapacityDisplay: formatPranaDisplayFromRaw(buyBondCapacityRaw),
    buyBondCommittedPercent,
    buyBondCapacityPercent,
    sellBondBalanceDisplay: formatBigIntValue(sellBondBalanceRaw),
    sellBondCommittedDisplay: formatBigIntValue(sellBondCommittedRaw),
    sellBondCapacityDisplay: formatBigIntValue(sellBondCapacityRaw),
    sellBondCommittedPercent,
    sellBondCapacityPercent,
  };
};
