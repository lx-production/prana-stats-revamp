import { useCallback } from 'react';
import { ethers } from 'ethers';
import { getBondingStats } from '../utils/bondingStats';
import { asBigInt, safeContractCall } from '../utils/pranaStatsUtils';
import type { FetchBondingStats } from '../types';
import { PRANA_ABI, PRANA_ADDRESS, PRANA_DECIMALS, WBTC_ADDRESS, WBTC_ABI } from '../constants/sharedContracts';
import { BUY_BOND_ADDRESS_V1, BUY_BOND_ADDRESS_V2, SELL_BOND_ADDRESS_V1, SELL_BOND_ADDRESS_V2, SELL_BOND_COMMITTED_WBTC_ABI, BUY_BOND_COMMITTED_PRANA_ABI } from '../constants/bonds.ts';

const BUY_BOND_V1_TOTAL_VOLUME_RAW = ethers.parseUnits('145235', PRANA_DECIMALS);
const SELL_BOND_V1_TOTAL_VOLUME_RAW = ethers.parseUnits('194235', PRANA_DECIMALS);

export function useBondsOnchain() {
  const fetchBondingStats: FetchBondingStats = useCallback(
    async ({ provider, buyBondTotalRawV2, sellBondTotalRawV2, pranaPriceVnd }) => {
      const tokenContract = new ethers.Contract(PRANA_ADDRESS, PRANA_ABI, provider);
      const wbtcTokenContract = new ethers.Contract(WBTC_ADDRESS, WBTC_ABI, provider);
      const buyBondV1Contract = new ethers.Contract(BUY_BOND_ADDRESS_V1, BUY_BOND_COMMITTED_PRANA_ABI, provider);
      const buyBondV2Contract = new ethers.Contract(BUY_BOND_ADDRESS_V2, BUY_BOND_COMMITTED_PRANA_ABI, provider);
      const sellBondV1Contract = new ethers.Contract(SELL_BOND_ADDRESS_V1, SELL_BOND_COMMITTED_WBTC_ABI, provider);
      const sellBondV2Contract = new ethers.Contract(SELL_BOND_ADDRESS_V2, SELL_BOND_COMMITTED_WBTC_ABI, provider);

      const [buyCommittedV2, buyCommittedV1, buyBalanceV2Raw, sellCommittedV2, sellCommittedV1, sellBalanceV2Raw] =
        await Promise.all([
          safeContractCall(buyBondV2Contract.committedPrana(), 0n),
          safeContractCall(buyBondV1Contract.committedPrana(), 0n),
          safeContractCall(tokenContract.balanceOf(BUY_BOND_ADDRESS_V2), 0n),
          safeContractCall(sellBondV2Contract.committedWbtc(), 0n),
          safeContractCall(sellBondV1Contract.committedWbtc(), 0n),
          safeContractCall(wbtcTokenContract.balanceOf(SELL_BOND_ADDRESS_V2), 0n),
        ]);

      return getBondingStats({
        buyCommittedV1: asBigInt(buyCommittedV1),
        buyCommittedV2: asBigInt(buyCommittedV2),
        buyBalanceV2: asBigInt(buyBalanceV2Raw),
        sellCommittedV1: asBigInt(sellCommittedV1),
        sellCommittedV2: asBigInt(sellCommittedV2),
        sellBalanceV2: asBigInt(sellBalanceV2Raw),
        buyBondTotalRawV2,
        sellBondTotalRawV2,
        buyBondV1TotalRaw: BUY_BOND_V1_TOTAL_VOLUME_RAW,
        sellBondV1TotalRaw: SELL_BOND_V1_TOTAL_VOLUME_RAW,
        pranaPriceVnd,
      });
    },
    []
  );

  return { fetchBondingStats };
}
