import { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import {
  BUY_BOND_ADDRESS_V1,
  BUY_BOND_ADDRESS_V2,
  BUY_BOND_COMMITTED_PRANA_ABI_V1,
  BUY_BOND_COMMITTED_PRANA_ABI_V2,
} from '../constants/bonds';
import { PRANA_ADDRESS, PRANA_ABI, PRANA_DECIMALS } from '../constants/sharedContracts';
import { useCommittedPrana } from './useCommittedPrana';
import { useTotalV2BondPranaVolume } from './useTotalV2BondPranaVolume';
import { getPolygonProvider } from '../utils/polygonProvider';

const BUY_BOND_V1_TOTAL_VOLUME_RAW = ethers.parseUnits('145235', PRANA_DECIMALS);

export const useBuyBondBalanceData = () => {
  const [balanceV2, setBalanceV2] = useState(0n);
  const [isLoadingBalanceV2, setIsLoadingBalanceV2] = useState(true);
  const [balanceErrorV2, setBalanceErrorV2] = useState(null);

  const {
    committedPranaRaw: committedPranaRawV2,
    isLoading: isLoadingCommittedV2,
    error: committedErrorV2,
  } = useCommittedPrana({
    contractAddress: BUY_BOND_ADDRESS_V2,
    contractAbi: BUY_BOND_COMMITTED_PRANA_ABI_V2,
  });

  const {
    committedPranaRaw: committedPranaRawV1,
    isLoading: isLoadingCommittedV1,
    error: committedErrorV1,
  } = useCommittedPrana({
    contractAddress: BUY_BOND_ADDRESS_V1,
    contractAbi: BUY_BOND_COMMITTED_PRANA_ABI_V1,
  });

  useEffect(() => {
    let cancelled = false;
    const provider = getPolygonProvider();
    const token = new ethers.Contract(PRANA_ADDRESS, PRANA_ABI, provider);

    const fetchBuyBondV2Balance = async () => {
      setIsLoadingBalanceV2(true);
      setBalanceErrorV2(null);
      try {
        const res = await token.balanceOf(BUY_BOND_ADDRESS_V2);
        if (!cancelled) setBalanceV2(typeof res === 'bigint' ? res : BigInt(res?.toString?.() ?? '0'));
      } catch (e) {
        if (!cancelled) {
          setBalanceErrorV2(e);
          setBalanceV2(0n);
        }
      } finally {
        if (!cancelled) setIsLoadingBalanceV2(false);
      }
    };

    fetchBuyBondV2Balance();

    return () => { cancelled = true; };
  }, []);

  const buyBondV2 = useMemo(() => [{ address: BUY_BOND_ADDRESS_V2 }], []);

  const {
    totalPranaRaw: totalBondVolumeRawV2,
    isLoading: isLoadingVolume,
    error: bondVolumeError,
  } = useTotalV2BondPranaVolume({
    contracts: buyBondV2,
  });

  useEffect(() => {
    if (balanceErrorV2) {
      console.error('Contract Balance V2 error:', balanceErrorV2);
    }
    if (committedErrorV1) {
      console.error('Committed Prana V1 error:', committedErrorV1);
    }
    if (committedErrorV2) {
      console.error('Committed Prana V2 error:', committedErrorV2);
    }
    if (bondVolumeError) {
      console.error('Bond volume error:', bondVolumeError);
    }
  }, [balanceErrorV2, committedErrorV1, committedErrorV2, bondVolumeError]);

  const isLoading =
    isLoadingBalanceV2 ||
    isLoadingCommittedV1 ||
    isLoadingCommittedV2 ||
    isLoadingVolume;

  const error =
    balanceErrorV2 || committedErrorV1 || committedErrorV2 || bondVolumeError;

  // BuyBond V1 holds only committed PRANA; non-committed PRANA is in BuyBond V2.
  // So "Balance" = PRANA in V2 contract + committed PRANA recorded in V1.
  const totalBalanceRaw = (balanceV2 || 0n) + (committedPranaRawV1 || 0n);
  const totalCommittedRaw = (committedPranaRawV1 || 0n) + (committedPranaRawV2 || 0n);
  const totalBondVolumeRaw = (totalBondVolumeRawV2 || 0n) + BUY_BOND_V1_TOTAL_VOLUME_RAW;

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

  const metrics = useMemo(
    () => {
      const parseAndRound = (value) => {
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
