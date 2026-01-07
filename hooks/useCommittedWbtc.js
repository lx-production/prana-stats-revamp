import { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { SELL_BOND_ADDRESS, SELL_BOND_ABI } from '../constants/sellBondContract';
import { WBTC_DECIMALS } from '../constants/sharedContracts';
import { getPolygonProvider } from '../utils/polygonProvider';

export const useCommittedWbtc = ({
  contractAddress = SELL_BOND_ADDRESS,
  contractAbi = SELL_BOND_ABI,
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
      const res = await contract.committedWbtc();
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
      return ethers.formatUnits(data ?? 0n, WBTC_DECIMALS);
    } catch {
      return '0';
    }
  }, [data]);

  return {
    committedWbtc: formattedData,
    committedWbtcRaw: data ?? 0n,
    isLoading,
    error,
    refetch: fetchCommitted,
  };
};