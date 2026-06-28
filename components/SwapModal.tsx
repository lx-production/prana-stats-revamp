import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownUp, Loader2, RefreshCw, X } from 'lucide-react';
import {
  DEFAULT_SWAP_SLIPPAGE_BPS,
  DEFAULT_SWAP_TOKEN_IN_SYMBOL,
  DEFAULT_SWAP_TOKEN_OUT_SYMBOL,
  getSwapToken,
  V1_SWAP_TOKENS,
} from '../constants/swapContracts';
import { useInjectedWallet } from '../hooks/useInjectedWallet';
import { useUniswapQuote } from '../hooks/useUniswapQuote';
import { useUniswapSwap } from '../hooks/useUniswapSwap';
import type { SwapModalProps, SwapTokenSymbol } from '../types/swap.types';
import {
  formatCompactAddress,
  formatSwapTokenAmount,
  isPositiveDecimalInput,
} from '../utils/swapTokenFormatting';

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const dialogVariants = {
  hidden: { opacity: 0, scale: 0.97, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0 },
};

function getActionLabel(
  isConnected: boolean,
  isPolygon: boolean,
  isQuoteLoading: boolean,
  needsApproval: boolean,
  status: string,
): string {
  if (!isConnected) return 'Connect Wallet';
  if (!isPolygon) return 'Switch to Polygon';
  if (status === 'approving') return 'Approve in Wallet';
  if (status === 'approval-confirming') return 'Confirming Approval';
  if (status === 'swapping') return 'Swap in Wallet';
  if (status === 'swap-confirming') return 'Confirming Swap';
  if (status === 'success') return 'Swap Complete';
  if (isQuoteLoading) return 'Finding Best Route';
  if (needsApproval) return 'Approve & Swap';
  return 'Swap';
}

export default function SwapModal({ isOpen, onClose }: SwapModalProps) {
  const [tokenInSymbol, setTokenInSymbol] = useState<SwapTokenSymbol>(DEFAULT_SWAP_TOKEN_IN_SYMBOL);
  const [tokenOutSymbol, setTokenOutSymbol] = useState<SwapTokenSymbol>(DEFAULT_SWAP_TOKEN_OUT_SYMBOL);
  const [amountIn, setAmountIn] = useState('');
  const [slippageBps] = useState(DEFAULT_SWAP_SLIPPAGE_BPS);
  const wallet = useInjectedWallet();
  const tokenIn = useMemo(() => getSwapToken(tokenInSymbol), [tokenInSymbol]);
  const tokenOut = useMemo(() => getSwapToken(tokenOutSymbol), [tokenOutSymbol]);
  const amountNumber = Number(amountIn);
  const hasAmount = Number.isFinite(amountNumber) && amountNumber > 0;
  const quoteState = useUniswapQuote({
    tokenInSymbol,
    tokenOutSymbol,
    amountIn,
    recipient: wallet.address,
    slippageBps,
    enabled: wallet.isConnected && wallet.isPolygon && hasAmount,
  });
  const swapState = useUniswapSwap({
    quote: quoteState.quote,
    tokenIn,
    ownerAddress: wallet.address,
  });
  const { resetSwapState } = swapState;
  const isBusy = [
    'approving',
    'approval-confirming',
    'swapping',
    'swap-confirming',
  ].includes(swapState.status);
  const actionLabel = getActionLabel(
    wallet.isConnected,
    wallet.isPolygon,
    quoteState.isLoading,
    swapState.needsApproval,
    swapState.status,
  );
  const canSwap = Boolean(
    wallet.isConnected &&
      wallet.isPolygon &&
      quoteState.quote &&
      !quoteState.isLoading &&
      !swapState.hasInsufficientBalance &&
      !isBusy,
  );

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      resetSwapState();
    }
  }, [isOpen, resetSwapState]);

  const updateTokenIn = (nextSymbol: SwapTokenSymbol) => {
    swapState.resetSwapState();
    if (nextSymbol === tokenOutSymbol) {
      setTokenOutSymbol(tokenInSymbol);
    }
    setTokenInSymbol(nextSymbol);
  };

  const updateTokenOut = (nextSymbol: SwapTokenSymbol) => {
    swapState.resetSwapState();
    if (nextSymbol === tokenInSymbol) {
      setTokenInSymbol(tokenOutSymbol);
    }
    setTokenOutSymbol(nextSymbol);
  };

  const reverseTokens = () => {
    swapState.resetSwapState();
    setTokenInSymbol(tokenOutSymbol);
    setTokenOutSymbol(tokenInSymbol);
    setAmountIn('');
  };

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;

    if (!isPositiveDecimalInput(nextValue)) return;

    swapState.resetSwapState();
    setAmountIn(nextValue);
  };

  const handleAction = async () => {
    if (!wallet.isConnected) {
      await wallet.connectWallet();
      return;
    }

    if (!wallet.isPolygon) {
      await wallet.ensurePolygon();
      return;
    }

    await swapState.executeSwap();
  };

  const estimatedOutput = quoteState.quote
    ? formatSwapTokenAmount(quoteState.quote.amountOutRaw, tokenOut)
    : '0';
  const minimumReceived = quoteState.quote
    ? formatSwapTokenAmount(quoteState.quote.minimumAmountOut, tokenOut)
    : '0';
  const balanceLabel = swapState.balance === null
    ? '...'
    : formatSwapTokenAmount(swapState.balance, tokenIn);

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="swap-title"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.2 }}
        >
          <motion.button
            type="button"
            onClick={onClose}
            aria-label="Close swap dialog"
            className="absolute inset-0 bg-black/55 backdrop-blur-md"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
          />

          <motion.div
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-[#070b1f]/85 shadow-[0_28px_90px_rgba(0,0,0,0.7)] ring-1 ring-[#FCE8A9]/10"
            variants={dialogVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.28 }}
          >
            <div className="border-b border-white/10 px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-[#F5D27A]/70">PRANA Trade</p>
                  <h2 id="swap-title" className="mt-1 text-xl font-semibold text-white">
                    Swap on Polygon
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/75 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3 flex items-center justify-between text-xs text-white/55">
                  <span>From</span>
                  <span>Balance: {balanceLabel}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    inputMode="decimal"
                    value={amountIn}
                    onChange={handleAmountChange}
                    placeholder="0.0"
                    className="min-w-0 flex-1 bg-transparent text-3xl font-medium text-white outline-none placeholder:text-white/20"
                  />
                  <select
                    value={tokenInSymbol}
                    onChange={(event) => updateTokenIn(event.target.value as SwapTokenSymbol)}
                    className="rounded-xl border border-white/15 bg-[#10152d] px-3 py-2 text-sm font-semibold text-white outline-none"
                  >
                    {V1_SWAP_TOKENS.map((token) => (
                      <option key={token.symbol} value={token.symbol}>
                        {token.symbol}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={reverseTokens}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#F5D27A]/25 bg-[#F5D27A]/10 text-[#F5D27A] transition hover:bg-[#F5D27A]/15"
                >
                  <ArrowDownUp className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3 flex items-center justify-between text-xs text-white/55">
                  <span>To</span>
                  <button
                    type="button"
                    onClick={quoteState.refetch}
                    className="inline-flex items-center gap-1 transition hover:text-white"
                    disabled={!hasAmount || quoteState.isLoading}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${quoteState.isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1 text-3xl font-medium text-white">
                    {quoteState.isLoading ? (
                      <span className="text-white/35">...</span>
                    ) : (
                      estimatedOutput
                    )}
                  </div>
                  <select
                    value={tokenOutSymbol}
                    onChange={(event) => updateTokenOut(event.target.value as SwapTokenSymbol)}
                    className="rounded-xl border border-white/15 bg-[#10152d] px-3 py-2 text-sm font-semibold text-white outline-none"
                  >
                    {V1_SWAP_TOKENS.map((token) => (
                      <option key={token.symbol} value={token.symbol}>
                        {token.symbol}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                <div className="flex justify-between gap-4">
                  <span>Slippage</span>
                  <span>{(slippageBps / 100).toFixed(2)}%</span>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span>Minimum received</span>
                  <span>{minimumReceived} {tokenOut.symbol}</span>
                </div>
                {quoteState.quote?.estimatedGasUsedUsd && (
                  <div className="mt-2 flex justify-between gap-4">
                    <span>Estimated gas</span>
                    <span>${Number(quoteState.quote.estimatedGasUsedUsd).toFixed(4)}</span>
                  </div>
                )}
                {quoteState.quote?.route.length ? (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/40">Route</p>
                    <div className="mt-2 space-y-1">
                      {quoteState.quote.route.map((route, index) => (
                        <div key={`${route.protocol}-${index}`} className="flex justify-between gap-3 text-xs">
                          <span>{route.path.join(' -> ')}</span>
                          <span>{route.percent}% {route.protocol}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {(quoteState.error || swapState.error || swapState.hasInsufficientBalance) && (
                <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {swapState.hasInsufficientBalance
                    ? `Insufficient ${tokenIn.symbol} balance.`
                    : swapState.error ?? quoteState.error}
                </div>
              )}

              {wallet.isConnected && (
                <div className="text-center text-xs text-white/50">
                  Connected: {formatCompactAddress(wallet.address ?? '')}
                </div>
              )}

              <button
                type="button"
                onClick={handleAction}
                disabled={wallet.isConnected && wallet.isPolygon && (!canSwap || !hasAmount)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#7A5410]/40 bg-[linear-gradient(120deg,#FBE9A7_0%,#F4D46E_18%,#D6A13A_38%,#F7DE84_58%,#B77B22_100%)] px-6 py-4 font-semibold text-[#2B1B05] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),inset_0_-10px_18px_rgba(120,73,0,0.45),0_16px_36px_rgba(0,0,0,0.38)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {(quoteState.isLoading || isBusy || wallet.isConnecting) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {actionLabel}
              </button>

              <p className="text-center text-xs leading-relaxed text-white/45">
                Quotes are prepared by PRANA&apos;s backend with Uniswap routing. Your wallet still signs every approval and swap.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
