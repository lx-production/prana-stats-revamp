import { ethers } from 'ethers';
import { useEffect, useMemo, useState } from 'react';
import { PRANA_DECIMALS } from '../constants/sharedContracts.ts';
import type { BuyBondMetric, UseBuyBondStatsResult } from '../types.ts';
import { fetchBondMetricsApi } from '../utils/bondMetricsApi.ts';

const BUY_BOND_V1_TOTAL_VOLUME_RAW = ethers.parseUnits('145235', PRANA_DECIMALS);

export const useBuyBondStats = (): UseBuyBondStatsResult => {
  const [totalBalanceRaw, setTotalBalanceRaw] = useState<bigint>(0n);
  const [totalCommittedRaw, setTotalCommittedRaw] = useState<bigint>(0n);
  const [totalBondVolumeRaw, setTotalBondVolumeRaw] = useState<bigint>(BUY_BOND_V1_TOTAL_VOLUME_RAW);
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

        setTotalBalanceRaw(BigInt(metrics.buy.totalBalanceRaw));
        setTotalCommittedRaw(BigInt(metrics.buy.totalCommittedRaw));
        setTotalBondVolumeRaw(BigInt(metrics.buy.totalVolumeRaw));
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e);
          setTotalBalanceRaw(0n);
          setTotalCommittedRaw(0n);
          setTotalBondVolumeRaw(BUY_BOND_V1_TOTAL_VOLUME_RAW);
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

  const formattedBalance = ethers.formatUnits(totalBalanceRaw, PRANA_DECIMALS);
  const formattedCommitted = ethers.formatUnits(totalCommittedRaw, PRANA_DECIMALS);
  const formattedBondVolume = ethers.formatUnits(totalBondVolumeRaw, PRANA_DECIMALS);

  const pranaFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 0,
      }),
    [],
  );

  const metrics = useMemo<BuyBondMetric[]>(
    () => {
      const parseAndRound = (value: string): { numericValue: number; formattedValue: string } => {
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) {
          return {
            numericValue: 0,
            formattedValue: pranaFormatter.format(0),
          };
        }

        const rounded = Math.round(numeric);
        return {
          numericValue: rounded,
          formattedValue: pranaFormatter.format(rounded),
        };
      };

      const balance = parseAndRound(formattedBalance);
      const committed = parseAndRound(formattedCommitted);
      const totalVolume = parseAndRound(formattedBondVolume);

      return [
        {
          key: 'balance',
          label: 'Balance',
          formattedValue: balance.formattedValue,
          numericValue: balance.numericValue,
          rawValue: totalBalanceRaw,
        },
        {
          key: 'committed',
          label: 'Committed',
          formattedValue: committed.formattedValue,
          numericValue: committed.numericValue,
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
    }, [
      formattedBalance,
      formattedCommitted,
      formattedBondVolume,
      pranaFormatter,
      totalBalanceRaw,
      totalCommittedRaw,
      totalBondVolumeRaw,
    ]);

  return {
    isLoading,
    error,
    metrics,
  };
};
