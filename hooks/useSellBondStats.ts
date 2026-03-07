import { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { PRANA_DECIMALS } from '../constants/sharedContracts.ts';
import { formatBigIntValue } from '../utils/bondingStatsHelpers.ts';
import { formatNumber } from '../utils/formatters.ts';
import type { SellBondMetric, UseSellBondStatsResult } from '../types.ts';
import { fetchBondMetricsApi } from '../utils/bondMetricsApi.ts';

const SELL_BOND_V1_TOTAL_VOLUME_RAW = ethers.parseUnits('194235', PRANA_DECIMALS);

export const useSellBondStats = (): UseSellBondStatsResult => {
  const [totalBalanceRaw, setTotalBalanceRaw] = useState<bigint>(0n);
  const [totalCommittedRaw, setTotalCommittedRaw] = useState<bigint>(0n);
  const [totalBondVolumeRaw, setTotalBondVolumeRaw] = useState<bigint>(SELL_BOND_V1_TOTAL_VOLUME_RAW);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const metrics = await fetchBondMetricsApi();
        if (cancelled) return;

        setTotalBalanceRaw(BigInt(metrics.sell.totalBalanceRaw));
        setTotalCommittedRaw(BigInt(metrics.sell.totalCommittedRaw));
        setTotalBondVolumeRaw(BigInt(metrics.sell.totalVolumeRaw));
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e);
          setTotalBalanceRaw(0n);
          setTotalCommittedRaw(0n);
          setTotalBondVolumeRaw(SELL_BOND_V1_TOTAL_VOLUME_RAW);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

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
            formattedValue: formatNumber(0),
          };
        }

        const rounded = Math.round(numeric);
        return {
          numericValue: rounded,
          formattedValue: formatNumber(rounded),
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
