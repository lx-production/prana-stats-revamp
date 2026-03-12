import { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { BUY_BOND_ADDRESS, BUY_BOND_ADDRESS_V1, BUY_BOND_ADDRESS_V2, BUY_BOND_COMMITTED_PRANA_ABI } from '../constants/bonds';
import { PRANA_DECIMALS } from '../constants/sharedContracts';
import { fetchBondMetricsApi } from '../utils/bondMetricsApi';

interface UseCommittedPranaParams {
  contractAddress?: string;
  contractAbi?: ethers.InterfaceAbi;
}

interface UseCommittedPranaResult {
  committedPrana: string;
  committedPranaRaw: bigint;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useCommittedPrana = ({
  contractAddress = BUY_BOND_ADDRESS,
  contractAbi = BUY_BOND_COMMITTED_PRANA_ABI,
}: UseCommittedPranaParams = {}): UseCommittedPranaResult => {
  const [data, setData] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCommitted = useCallback(async (opts: { force?: boolean } = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      void contractAbi;

      const metrics = await fetchBondMetricsApi(opts);
      const raw =
        contractAddress === BUY_BOND_ADDRESS_V1
          ? metrics.buy.v1CommittedRaw
          : contractAddress === BUY_BOND_ADDRESS_V2 || contractAddress === BUY_BOND_ADDRESS
            ? metrics.buy.v2CommittedRaw
            : null;

      if (raw === null) {
        throw new Error('Unsupported buy bond contract address');
      }

      setData(BigInt(raw));
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setData(0n);
    } finally {
      setIsLoading(false);
    }
  }, [contractAbi, contractAddress]);

  useEffect(() => {
    fetchCommitted();
  }, [fetchCommitted]);

  const formattedData = useMemo(() => {
    try {
      return ethers.formatUnits(data ?? 0n, PRANA_DECIMALS);
    } catch {
      return '0';
    }
  }, [data]);

  return {
    committedPrana: formattedData,
    committedPranaRaw: data ?? 0n,
    isLoading,
    error,
    refetch: () => fetchCommitted({ force: true }),
  };
};
