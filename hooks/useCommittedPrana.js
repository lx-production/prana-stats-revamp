import { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { BUY_BOND_ADDRESS, BUY_BOND_COMMITTED_PRANA_ABI } from '../constants/bonds';
import { PRANA_DECIMALS } from '../constants/sharedContracts';
import { getPolygonProvider } from '../utils/polygonProvider';

export const useCommittedPrana = ({
  contractAddress = BUY_BOND_ADDRESS,
  contractAbi = BUY_BOND_COMMITTED_PRANA_ABI,
} = {}) => {
  const [data, setData] = useState(0n);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const contract = useMemo(() => {
    const provider = getPolygonProvider();
    return new ethers.Contract(contractAddress, contractAbi, provider);
  }, [contractAddress, contractAbi]);

  const fetchCommitted = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await contract.committedPrana();
      setData(typeof res === 'bigint' ? res : BigInt(res?.toString?.() ?? '0'));
    } catch (e) {
      setError(e);
      setData(0n);
    } finally {
      setIsLoading(false);
    }
  }, [contract]);

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
    refetch: fetchCommitted,
  };
};