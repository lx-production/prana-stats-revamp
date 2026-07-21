import { erc20Abi } from 'viem';
import { usePublicClient, useWalletClient } from 'wagmi';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseSwapTokenAmount } from '../utils/swapTokenFormatting';
import { logSwapTransactionEvent } from '../utils/swapTransactionLogs';
import { sanitizeSwapWalletError } from '../utils/sanitizeSwapWalletError';
import { POLYGON_CHAIN_ID, UNISWAP_SWAP_ROUTER_02_ADDRESS } from '../constants/swapContracts';

import type { HexAddress, SwapTransactionStatus, UseUniswapSwapInput, UseUniswapSwapResult } from '../types/swap.types';

// Treat the quote as expired a few seconds early so we don't send a tx
// that fails right as the Uniswap deadline passes.
const QUOTE_EXPIRY_BUFFER_SECONDS = 5;

/**
 * Owns the on-chain swap flow after a quote is loaded:
 * - reads wallet balance + ERC-20 allowance
 * - decides if approval is needed
 * - optionally approves the Uniswap router
 * - sends the swap transaction and waits for confirmation
 */
export function useUniswapSwap({
  quote,
  tokenIn,
  tokenOut,
  amountIn,
  slippageBps,
  ownerAddress,
}: UseUniswapSwapInput): UseUniswapSwapResult {
  // Polygon-only clients: reads (public) and signed writes (wallet).
  const publicClient = usePublicClient({ chainId: POLYGON_CHAIN_ID });
  const { data: walletClient } = useWalletClient({ chainId: POLYGON_CHAIN_ID });

  const [balance, setBalance] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false);

  // High-level UI status machine: idle → approving → swapping → success/error, etc.
  const [status, setStatus] = useState<SwapTransactionStatus>('idle');
  const [transactionHash, setTransactionHash] = useState<HexAddress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Wall-clock seconds, updated every second while a quote is present
  // so we can detect quote expiry without relying on a one-shot timer.
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));

  // User-typed amount converted to token base units (wei / smallest unit).
  const amountInRaw = useMemo(() => {
    if (!amountIn) return 0n;
    return parseSwapTokenAmount(amountIn, tokenIn);
  }, [amountIn, tokenIn]);

  // Same conversion for the amount baked into the current quote.
  // Used when checking allowance / approving.
  const quoteAmountInRaw = useMemo(() => {
    if (!quote) return 0n;
    return parseSwapTokenAmount(quote.amountIn, tokenIn);
  }, [quote, tokenIn]);

  // Tick once per second while we have a quote, so expiry UI stays fresh.
  useEffect(() => {
    if (!quote) return;

    setNowSeconds(Math.floor(Date.now() / 1000));
    const intervalId = window.setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [quote]);

  // True when the quote's Uniswap deadline is too close (or already past).
  const isQuoteExpired = Boolean(
    quote && quote.deadline <= nowSeconds + QUOTE_EXPIRY_BUFFER_SECONDS,
  );

  // A quote is only "current" if it still matches what the user is trying to swap.
  // If they change amount/tokens/slippage/wallet, we force a refresh before swapping.
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

  // Re-read on-chain balance (and ERC-20 allowance to the Uniswap router).
  const refreshBalances = useCallback(async () => {
    if (!publicClient || !ownerAddress) {
      setBalance(null);
      setAllowance(null);
      return;
    }

    setIsRefreshingBalances(true);

    try {
      // Native POL has no approve() — only fetch the wallet's POL balance.
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

      // ERC-20: fetch balance + how much the router is already allowed to spend.
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

  // Keep balances in sync whenever wallet / token-in changes.
  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  // ERC-20 only: router can't pull tokens until allowance >= the quoted amount.
  const needsApproval = isQuoteCurrent && tokenIn.kind === 'erc20' && quoteAmountInRaw > 0n && (allowance ?? 0n) < quoteAmountInRaw;
  const hasInsufficientBalance = amountInRaw > 0n && balance !== null && balance < amountInRaw;

  // Clear tx status/error when the modal resets or the user starts over.
  const resetSwapState = useCallback(() => {
    setStatus('idle');
    setTransactionHash(null);
    setError(null);
  }, []);

  // If allowance is too low, ask the user to approve the router first.
  // This is a separate on-chain tx from the actual swap.
  const approveIfNeeded = useCallback(async () => {
    if (!needsApproval) return;

    if (!walletClient || !ownerAddress || !tokenIn.address) {
      throw new Error('Connect your Polygon wallet before approving.');
    }

    let approvalHash: HexAddress | undefined;

    try {
      setStatus('approving');
      // Approval goes to the token contract (e.g. USDC), not the router.
      // Spender = Uniswap Swap Router 02 on Polygon.
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
      // Re-read allowance so the UI knows approval succeeded.
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

  // Full swap path: validate quote → approve if needed → send swap tx → wait → refresh balances.
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

    // `swapStarted` tells the catch block whether failure happened during
    // the swap itself (vs. during the earlier approval step).
    let swapStarted = false;
    let swapHash: HexAddress | undefined;

    try {
      await approveIfNeeded();

      swapStarted = true;
      setStatus('swapping');
      // Send the exact calldata the quote backend prepared for Swap Router 02.
      // `value` is non-zero only when paying with native POL.
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
      // Only log swap_failed if we already got past approval into the swap tx.
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
      // Never dump raw viem/wallet error text into the modal (long calldata overflows the UI).
      setError(
        sanitizeSwapWalletError(
          err,
          swapStarted ? 'Swap failed. Please try again.' : 'Approval failed. Please try again.',
        ),
      );
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
