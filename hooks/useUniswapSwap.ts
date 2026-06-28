import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import {
  POLYGON_CHAIN_ID,
  SWAP_ERC20_ABI,
  UNISWAP_SWAP_ROUTER_02_ADDRESS,
} from '../constants/swapContracts';
import type {
  HexAddress,
  SwapTransactionStatus,
  UseUniswapSwapInput,
  UseUniswapSwapResult,
} from '../types/swap.types';
import { parseSwapTokenAmount } from '../utils/swapTokenFormatting';

export function useUniswapSwap({
  quote,
  tokenIn,
  ownerAddress,
}: UseUniswapSwapInput): UseUniswapSwapResult {
  const publicClient = usePublicClient({ chainId: POLYGON_CHAIN_ID });
  const { data: walletClient } = useWalletClient({ chainId: POLYGON_CHAIN_ID });
  const [balance, setBalance] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false);
  const [status, setStatus] = useState<SwapTransactionStatus>('idle');
  const [transactionHash, setTransactionHash] = useState<HexAddress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const amountInRaw = useMemo(() => {
    if (!quote) return 0n;
    return parseSwapTokenAmount(quote.amountIn, tokenIn);
  }, [quote, tokenIn]);

  const refreshBalances = useCallback(async () => {
    if (!publicClient || !ownerAddress) {
      setBalance(null);
      setAllowance(null);
      return;
    }

    setIsRefreshingBalances(true);

    try {
      if (tokenIn.kind === 'native') {
        const nextBalance = await publicClient.getBalance({ address: ownerAddress });
        setBalance(nextBalance);
        setAllowance(null);
        return;
      }

      if (!tokenIn.address) {
        setBalance(null);
        setAllowance(null);
        return;
      }

      const [nextBalance, nextAllowance] = await Promise.all([
        publicClient.readContract({
          address: tokenIn.address,
          abi: SWAP_ERC20_ABI,
          functionName: 'balanceOf',
          args: [ownerAddress],
        } as never),
        publicClient.readContract({
          address: tokenIn.address,
          abi: SWAP_ERC20_ABI,
          functionName: 'allowance',
          args: [ownerAddress, UNISWAP_SWAP_ROUTER_02_ADDRESS],
        } as never),
      ]);

      setBalance(nextBalance as bigint);
      setAllowance(nextAllowance as bigint);
    } finally {
      setIsRefreshingBalances(false);
    }
  }, [ownerAddress, publicClient, tokenIn]);

  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  const needsApproval = tokenIn.kind === 'erc20' && amountInRaw > 0n && (allowance ?? 0n) < amountInRaw;
  const hasInsufficientBalance = amountInRaw > 0n && balance !== null && balance < amountInRaw;

  const resetSwapState = useCallback(() => {
    setStatus('idle');
    setTransactionHash(null);
    setError(null);
  }, []);

  const approveIfNeeded = useCallback(async () => {
    if (!needsApproval) return;

    if (!walletClient || !ownerAddress || !tokenIn.address) {
      throw new Error('Connect your Polygon wallet before approving.');
    }

    setStatus('approving');
    const approvalHash = await walletClient.writeContract({
      account: ownerAddress,
      address: tokenIn.address,
      abi: SWAP_ERC20_ABI,
      functionName: 'approve',
      args: [UNISWAP_SWAP_ROUTER_02_ADDRESS, amountInRaw],
    });

    setTransactionHash(approvalHash);
    setStatus('approval-confirming');
    await publicClient?.waitForTransactionReceipt({ hash: approvalHash });
    setStatus('approved');
    await refreshBalances();
  }, [amountInRaw, needsApproval, ownerAddress, publicClient, refreshBalances, tokenIn.address, walletClient]);

  const executeSwap = useCallback(async () => {
    if (!quote) {
      setError('Load a quote before swapping.');
      return;
    }

    if (!walletClient || !ownerAddress) {
      setError('Connect your Polygon wallet before swapping.');
      return;
    }

    if (hasInsufficientBalance) {
      setError(`Insufficient ${tokenIn.symbol} balance.`);
      return;
    }

    setError(null);

    try {
      await approveIfNeeded();

      setStatus('swapping');
      const swapHash = await walletClient.sendTransaction({
        account: ownerAddress,
        to: quote.transaction.to,
        data: quote.transaction.data,
        value: BigInt(quote.transaction.value || '0'),
      } as never);

      setTransactionHash(swapHash);
      setStatus('swap-confirming');
      await publicClient?.waitForTransactionReceipt({ hash: swapHash });
      setStatus('success');
      await refreshBalances();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Swap failed.');
    }
  }, [
    approveIfNeeded,
    hasInsufficientBalance,
    ownerAddress,
    publicClient,
    quote,
    refreshBalances,
    tokenIn.symbol,
    walletClient,
  ]);

  return {
    balance,
    allowance,
    isRefreshingBalances,
    needsApproval,
    hasInsufficientBalance,
    status,
    transactionHash,
    error,
    refreshBalances,
    executeSwap,
    resetSwapState,
  };
}
