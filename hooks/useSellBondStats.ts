import { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { WBTC_ADDRESS, WBTC_ABI, PRANA_DECIMALS } from '../constants/sharedContracts.ts';
import { useCommittedWbtc } from './useCommittedWbtc.ts';
import { useBondsV2Volume } from './useBondsV2Volume.ts';
import { getPolygonProvider } from '../utils/polygonProvider.ts';
import { formatBigIntValue } from '../utils/bondingStatsHelpers.ts';
import { formatInteger } from '../utils/formatters.ts';
import { SELL_BOND_ADDRESS_V1, SELL_BOND_ADDRESS_V2, SELL_BOND_COMMITTED_WBTC_ABI } from '../constants/bonds.ts';
import type { SellBondMetric, UseSellBondStatsResult } from '../types.ts';

const SELL_BOND_V1_TOTAL_VOLUME_RAW = ethers.parseUnits('194235', PRANA_DECIMALS);

export const useSellBondStats = (): UseSellBondStatsResult => {
  const [balanceV2, setBalanceV2] = useState<bigint>(0n);
  const [isLoadingBalanceV2, setIsLoadingBalanceV2] = useState<boolean>(true);
  const [balanceErrorV2, setBalanceErrorV2] = useState<unknown | null>(null);

  const {
    committedWbtcRaw: committedWbtcRawV2,
    isLoading: isLoadingCommittedV2,
    error: committedErrorV2,
  } = useCommittedWbtc({
    contractAddress: SELL_BOND_ADDRESS_V2,
    contractAbi: SELL_BOND_COMMITTED_WBTC_ABI,
  });

  const {
    committedWbtcRaw: committedWbtcRawV1,
    isLoading: isLoadingCommittedV1,
    error: committedErrorV1,
  } = useCommittedWbtc({
    contractAddress: SELL_BOND_ADDRESS_V1,
    contractAbi: SELL_BOND_COMMITTED_WBTC_ABI,
  });

  useEffect(() => {
    let cancelled = false;
    const provider = getPolygonProvider();
    const token = new ethers.Contract(WBTC_ADDRESS, WBTC_ABI, provider);

    const fetchBalanceV2 = async () => {
      setIsLoadingBalanceV2(true);
      setBalanceErrorV2(null);
      try {
        const res = await token.balanceOf(SELL_BOND_ADDRESS_V2);
        if (!cancelled) setBalanceV2(typeof res === 'bigint' ? res : BigInt(res?.toString?.() ?? '0'));
      } catch (e: unknown) {
        if (!cancelled) {
          setBalanceErrorV2(e);
          setBalanceV2(0n);
        }
      } finally {
        if (!cancelled) setIsLoadingBalanceV2(false);
      }
    };

    fetchBalanceV2();

    return () => {
      cancelled = true;
    };
  }, []);

  const {
    sellBondTotalRawV2,
    isLoading: isLoadingVolume,
    error: bondVolumeError,
  } = useBondsV2Volume();

  useEffect(() => {
    if (balanceErrorV2) {
      console.error('Sell bond balance V2 error:', balanceErrorV2);
    }
    if (committedErrorV1) {
      console.error('Sell bond committed WBTC V1 error:', committedErrorV1);
    }
    if (committedErrorV2) {
      console.error('Sell bond committed WBTC V2 error:', committedErrorV2);
    }
    if (bondVolumeError) {
      console.error('Sell bond volume error:', bondVolumeError);
    }
  }, [balanceErrorV2, committedErrorV1, committedErrorV2, bondVolumeError]);

  const isLoading =
    isLoadingBalanceV2 ||
    isLoadingCommittedV1 ||
    isLoadingCommittedV2 ||
    isLoadingVolume;

  const error =
    balanceErrorV2 || committedErrorV1 || committedErrorV2 || bondVolumeError;

  // SellBond V1 holds only committed WBTC; non-committed WBTC is in SellBond V2.
  // So "Balance" = WBTC in V2 contract + committed WBTC recorded in V1.
  const totalBalanceRaw = (balanceV2 || 0n) + (committedWbtcRawV1 || 0n);
  const totalCommittedRaw = (committedWbtcRawV1 || 0n) + (committedWbtcRawV2 || 0n);
  const totalBondVolumeRaw = (sellBondTotalRawV2 || 0n) + SELL_BOND_V1_TOTAL_VOLUME_RAW;

  const formattedBalanceSat = formatBigIntValue(totalBalanceRaw);
  const formattedCommittedSat = formatBigIntValue(totalCommittedRaw);
  const formattedBondVolume = ethers.formatUnits(totalBondVolumeRaw, PRANA_DECIMALS);

  const metrics = useMemo<SellBondMetric[]>(
    () => {
      const parseAndRound = (value: string): { numericValue: number; formattedValue: string } => {
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) {
          return {
            numericValue: 0,
            formattedValue: formatInteger(0),
          };
        }

        const rounded = Math.round(numeric);
        return {
          numericValue: rounded,
          formattedValue: formatInteger(rounded),
        };
      };

      const totalVolume = parseAndRound(formattedBondVolume);

      return [
        {
          key: 'balance',
          label: 'Balance',
          formattedValue: formattedBalanceSat,
          numericValue: Number(totalBalanceRaw),
          rawValue: totalBalanceRaw,
        },
        {
          key: 'committed',
          label: 'Committed',
          formattedValue: formattedCommittedSat,
          numericValue: Number(totalCommittedRaw),
          rawValue: totalCommittedRaw,
        },
        {
          key: 'totalVolume',
          label: 'Total Volume (V1 + V2)',
          formattedValue: totalVolume.formattedValue,
          numericValue: totalVolume.numericValue,
          rawValue: totalBondVolumeRaw,
        },
      ];
    },
    [
      formattedBalanceSat,
      formattedCommittedSat,
      formattedBondVolume,
      totalBalanceRaw,
      totalCommittedRaw,
      totalBondVolumeRaw,
    ],
  );

  return {
    isLoading,
    error,
    metrics,
  };
};
