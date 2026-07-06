import { erc20Abi } from 'viem';
import { usePublicClient, useWalletClient } from 'wagmi';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseSwapTokenAmount } from '../utils/swapTokenFormatting';
import { logSwapTransactionEvent } from '../utils/swapTransactionLogs';
import { POLYGON_CHAIN_ID, UNISWAP_SWAP_ROUTER_02_ADDRESS } from '../constants/swapContracts';
import type { HexAddress, SwapTransactionStatus, UseUniswapSwapInput, UseUniswapSwapResult } from '../types/swap.types';

const QUOTE_EXPIRY_BUFFER_SECONDS = 5;

export function useUniswapSwap({
  quote,
  tokenIn,
  tokenOut,
  amountIn,
  slippageBps,
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
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));

  const amountInRaw = useMemo(() => {
    if (!amountIn) return 0n;
    return parseSwapTokenAmount(amountIn, tokenIn);
  }, [amountIn, tokenIn]);

  const quoteAmountInRaw = useMemo(() => {
    if (!quote) return 0n;
    return parseSwapTokenAmount(quote.amountIn, tokenIn);
  }, [quote, tokenIn]);

  useEffect(() => {
    if (!quote) return;

    setNowSeconds(Math.floor(Date.now() / 1000));
    const intervalId = window.setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [quote]);

  const isQuoteExpired = Boolean(
    quote && quote.deadline <= nowSeconds + QUOTE_EXPIRY_BUFFER_SECONDS,
  );

  const isQuoteCurrent = useMemo(() => {
    if (!quote || !ownerAddress) return false;
    if (isQuoteExpired) return false;

    return (
      quote.request.chainId === POLYGON_CHAIN_ID &&
      quote.request.tokenInSymbol === tokenIn.symbol &&
      quote.request.tokenOutSymbol === tokenOut.symbol &&
      quote.request.amountInRaw === amountInRaw.toString() &&
      quote.request.recipient.toLowerCase() === ownerAddress.toLowerCase() &&
      quote.request.slippageBps === slippageBps &&
      quote.routerAddress.toLowerCase() === UNISWAP_SWAP_ROUTER_02_ADDRESS.toLowerCase() &&
      quote.transaction.to.toLowerCase() === UNISWAP_SWAP_ROUTER_02_ADDRESS.toLowerCase()
    );
  }, [amountInRaw, isQuoteExpired, ownerAddress, quote, slippageBps, tokenIn.symbol, tokenOut.symbol]);

  const refreshBalances = useCallback(async () => {
    if (!publicClient || !ownerAddress) {
      setBalance(null);
      setAllowance(null);
      return;
    }

    setIsRefreshingBalances(true);

    try {
      // If swapping native POL, there's no ERC-20 approval.
      if (tokenIn.kind === 'native') {
        const fetchedBalance = await publicClient.getBalance({ address: ownerAddress });
        setBalance(fetchedBalance);
        setAllowance(null);
        return;
      }

      if (!tokenIn.address) {
        setBalance(null);
        setAllowance(null);
        return;
      }

      const [fetchedBalance, fetchedAllowance] = await Promise.all([
        publicClient.readContract({
          address: tokenIn.address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [ownerAddress],
        } as never),
        publicClient.readContract({
          address: tokenIn.address,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [ownerAddress, UNISWAP_SWAP_ROUTER_02_ADDRESS],
        } as never),
      ]);

      setBalance(fetchedBalance as bigint);
      setAllowance(fetchedAllowance as bigint);
    } finally {
      setIsRefreshingBalances(false);
    }
  }, [ownerAddress, publicClient, tokenIn]);

  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  const needsApproval = isQuoteCurrent && tokenIn.kind === 'erc20' && quoteAmountInRaw > 0n && (allowance ?? 0n) < quoteAmountInRaw;
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

    let approvalHash: HexAddress | undefined;

    try {
      setStatus('approving');
      // The approval tx is sent to the token contract (e.g. USDC), not to the router.
      // The spender is Uniswap’s official Swap Router 02 on Polygon.
      approvalHash = await walletClient.writeContract({
        account: ownerAddress,
        address: tokenIn.address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [UNISWAP_SWAP_ROUTER_02_ADDRESS, quoteAmountInRaw],
      } as never);

      logSwapTransactionEvent({
        event: 'approval_submitted',
        quote,
        ownerAddress,
        transactionHash: approvalHash,
      });

      setTransactionHash(approvalHash);
      setStatus('approval-confirming');
      const receipt = await publicClient?.waitForTransactionReceipt({ hash: approvalHash });

      if (receipt?.status === 'reverted') {
        throw new Error('Approval transaction reverted.');
      }

      logSwapTransactionEvent({
        event: 'approval_confirmed',
        quote,
        ownerAddress,
        transactionHash: approvalHash,
        receiptStatus: receipt?.status,
      });

      setStatus('approved');
      await refreshBalances();
    } catch (err) {
      logSwapTransactionEvent({
        event: 'approval_failed',
        quote,
        ownerAddress,
        transactionHash: approvalHash,
        error: err,
      });
      throw err;
    }
  }, [needsApproval, ownerAddress, publicClient, quote, quoteAmountInRaw, refreshBalances, tokenIn.address, walletClient]);

  const executeSwap = useCallback(async () => {
    if (!quote) {
      setError('Load a quote before swapping.');
      return;
    }

    if (!isQuoteCurrent) {
      setError(isQuoteExpired ? 'Quote expired. Refresh to continue.' : 'Refresh the quote before swapping.');
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

    let swapStarted = false;
    let swapHash: HexAddress | undefined;

    try {
      await approveIfNeeded();

      swapStarted = true;
      setStatus('swapping');
      swapHash = await walletClient.sendTransaction({
        account: ownerAddress,
        to: quote.transaction.to,
        data: quote.transaction.data,
        value: BigInt(quote.transaction.value || '0'),
      } as never);

      logSwapTransactionEvent({
        event: 'swap_submitted',
        quote,
        ownerAddress,
        transactionHash: swapHash,
      });

      setTransactionHash(swapHash);
      setStatus('swap-confirming');
      const receipt = await publicClient?.waitForTransactionReceipt({ hash: swapHash });

      if (receipt?.status === 'reverted') {
        throw new Error('Swap transaction reverted.');
      }

      logSwapTransactionEvent({
        event: 'swap_confirmed',
        quote,
        ownerAddress,
        transactionHash: swapHash,
        receiptStatus: receipt?.status,
      });

      setStatus('success');
      await refreshBalances();
    } catch (err) {
      if (swapStarted) {
        logSwapTransactionEvent({
          event: 'swap_failed',
          quote,
          ownerAddress,
          transactionHash: swapHash,
          error: err,
        });
      }

      setStatus('error');
      setError(err instanceof Error ? err.message : 'Swap failed.');
    }
  }, [
    approveIfNeeded,
    hasInsufficientBalance,
    isQuoteCurrent,
    isQuoteExpired,
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
    isQuoteExpired,
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
