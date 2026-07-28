import { useCallback, useEffect, useMemo, useState } from 'react';
import { erc20Abi } from 'viem';
import { usePublicClient } from 'wagmi';
import { polygon } from 'wagmi/chains';
import { POLYGON_CHAIN_ID } from '../../../constants/network.ts';
import {
  BUY_BOND_ADDRESS_V2,
  BUY_BOND_V2_ABI,
  SELL_BOND_ADDRESS_V2,
  SELL_BOND_V2_ABI,
} from '../../../constants/bonds.ts';
import {
  PRANA_ADDRESS,
  WBTC_ADDRESS,
} from '../../../constants/sharedContracts.ts';
import { useInjectedWallet } from '../../web3/useInjectedWallet.ts';
import { getPolygonWalletClient } from '../../web3/getPolygonWalletClient.ts';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage.ts';
import { confirmBondingTransactionOnServer } from '../bondingApi.ts';
import { getBondingCopy } from '../bonding.copy.ts';
import { accountFromSuccessfulRefetch } from '../accountRefetch.ts';
import {
  formatBondingError,
  getBondingErrorMessage,
} from '../bondingErrors.ts';
import { getConfiguredTerm } from '../bondingMath.ts';
import {
  confirmBondReceipt,
  resolveBondCtaAction,
  runBondCtaBranch,
  submitBondWriteFlow,
} from '../bondTransactionFlow.ts';
import {
  isAllowanceSufficientForCreate,
  needsExactInputApproval,
  needsTargetPranaApproval,
  resolveApproveAmountRaw,
} from '../utils/bondAllowance.ts';

import type { Address, Hex } from '../../../types/blockchain.types.ts';
import type {
  BondingAccount,
  BondingConfig,
  BondingQuote,
  BondingQuoteMode,
  BondingTransactionActionSnapshot,
  BondSide,
  BondTermId,
  BondTransactionStatus,
} from '../bonding.types.ts';
import type { PendingBondTransaction } from '../bondTransactionFlow.ts';

export type BuyInputMode = 'exact_wbtc' | 'target_prana';

type UseBondTransactionInput = {
  config: BondingConfig | undefined;
  account: BondingAccount | undefined;
  side: BondSide;
  buyMode: BuyInputMode;
  amountRaw: bigint | null;
  termId: BondTermId | null;
  /** Live quote used for allowance checks; create uses a fresh quote. */
  quote: BondingQuote | null;
  freshQuote: () => Promise<BondingQuote | null>;
  refetchAccount: () => Promise<unknown>;
  refetchConfig: () => Promise<unknown>;
};

function quoteModeFor(
  side: BondSide,
  buyMode: BuyInputMode,
): BondingQuoteMode {
  if (side === 'sell') return 'sell_exact_prana';
  return buyMode === 'target_prana' ? 'buy_target_prana' : 'buy_exact_wbtc';
}

function currentAllowanceRaw(
  account: BondingAccount | undefined,
  side: BondSide,
): bigint {
  if (!account) return 0n;
  return side === 'buy'
    ? BigInt(account.buyV2WbtcAllowanceRaw)
    : BigInt(account.sellV2PranaAllowanceRaw);
}

/**
 * Approve → Review → Create Bond → Confirming.
 * Max two wallet prompts on separate clicks; never auto-chain approve+create.
 */
export function useBondTransaction({
  config,
  account,
  side,
  buyMode,
  amountRaw,
  termId,
  quote,
  freshQuote,
  refetchAccount,
  refetchConfig,
}: UseBondTransactionInput) {
  const { locale } = useSiteLanguage();
  const copy = getBondingCopy(locale);
  const wallet = useInjectedWallet();
  const publicClient = usePublicClient({ chainId: POLYGON_CHAIN_ID });

  const [status, setStatus] = useState<BondTransactionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  /** Broadcast awaiting confirmation (resume path). Cleared on success/revert. */
  const [pending, setPending] = useState<PendingBondTransaction | null>(null);
  /** Last hash to show on Polygonscan (success or pending). */
  const [transactionHash, setTransactionHash] = useState<Hex | null>(null);
  const [reviewQuote, setReviewQuote] = useState<BondingQuote | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  /** Target-PRANA spending cap set this session via approve(quote). */
  const [sessionApprovedCapRaw, setSessionApprovedCapRaw] = useState<
    string | null
  >(null);

  const mode = quoteModeFor(side, buyMode);
  const amountRawString = amountRaw != null ? amountRaw.toString() : '';

  // Changing form inputs before broadcast clears review + session cap.
  useEffect(() => {
    if (pending) return;
    setReviewQuote(null);
    setReviewOpen(false);
    setSessionApprovedCapRaw(null);
    if (status === 'reviewing') setStatus('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to form identity
  }, [side, buyMode, amountRawString, termId, wallet.address, wallet.chainId]);

  const quoteWbtcRaw = quote ? BigInt(quote.wbtcAmountRaw) : 0n;
  const allowance = currentAllowanceRaw(account, side);

  const needsApproval = useMemo(() => {
    if (amountRaw == null || amountRaw <= 0n) return false;
    if (!quote || quote.issues.length > 0) return false;

    if (mode === 'buy_target_prana') {
      return needsTargetPranaApproval({
        currentAllowanceRaw: allowance,
        quoteWbtcAmountRaw: quoteWbtcRaw,
        sessionApprovedCapRaw:
          sessionApprovedCapRaw != null ? BigInt(sessionApprovedCapRaw) : null,
      });
    }

    return needsExactInputApproval(allowance, amountRaw);
  }, [
    amountRaw,
    allowance,
    mode,
    quote,
    quoteWbtcRaw,
    sessionApprovedCapRaw,
  ]);

  const clearMessages = useCallback(() => {
    setError(null);
    setWarning(null);
    setSuccess(null);
  }, []);

  const resetAfterSuccess = useCallback(() => {
    setStatus('idle');
    setPending(null);
    setTransactionHash(null);
    setReviewQuote(null);
    setReviewOpen(false);
    setSessionApprovedCapRaw(null);
  }, []);

  const closeReview = useCallback(() => {
    if (status === 'submitting' || status === 'confirming') return;
    setReviewOpen(false);
    setReviewQuote(null);
    if (status === 'reviewing') setStatus('idle');
  }, [status]);

  const ensurePolygonWalletClient = useCallback(async () => {
    if (!wallet.isPolygon) {
      await wallet.ensurePolygon();
    }
    const client = await getPolygonWalletClient();
    if (!client || !publicClient) {
      throw new Error('RPC unavailable');
    }
    return client;
  }, [publicClient, wallet]);

  const applyConfirmed = useCallback(
    (hash: Hex, syncFailed: boolean) => {
      setPending(null);
      setTransactionHash(hash);
      setReviewOpen(false);
      setReviewQuote(null);
      setStatus('success');
      setError(null);
      setSuccess(copy.bondConfirmed);
      setWarning(syncFailed ? copy.accountSyncWarning : null);
    },
    [copy.accountSyncWarning, copy.bondConfirmed],
  );

  const resumeConfirmReceipt = useCallback(
    async (pendingTx: PendingBondTransaction) => {
      if (!wallet.address) return;

      setStatus('confirming');
      setError(null);
      setWarning(null);

      const outcome = await confirmBondReceipt(pendingTx.hash, {
        waitForReceipt: (txHash) =>
          publicClient!.waitForTransactionReceipt({ hash: txHash }),
        confirmOnServer: (txHash) =>
          confirmBondingTransactionOnServer({
            transactionHash: txHash,
            account: wallet.address as Address,
            action: pendingTx.action,
          }),
        refetchAccount,
      });

      if (outcome.kind === 'confirmed') {
        applyConfirmed(pendingTx.hash, outcome.syncFailed);
        return;
      }

      if (outcome.kind === 'reverted') {
        setPending(null);
        setTransactionHash(null);
        setStatus('error');
        setError(getBondingErrorMessage('reverted', locale));
        return;
      }

      // Keep hash + snapshot; never treat as failed write.
      setPending(pendingTx);
      setTransactionHash(pendingTx.hash);
      setStatus('confirmation_unavailable');
      setError(copy.confirmationUnavailable);
    },
    [
      applyConfirmed,
      copy.confirmationUnavailable,
      locale,
      publicClient,
      refetchAccount,
      wallet.address,
    ],
  );

  const runApprove = useCallback(async () => {
    if (!wallet.isConnected || !wallet.address) {
      setError(getBondingErrorMessage('not_connected', locale));
      setStatus('error');
      return;
    }
    if (!config) {
      setError(getBondingErrorMessage('generic', locale));
      setStatus('error');
      return;
    }

    const paused =
      side === 'buy' ? config.paused.buyV2 : config.paused.sellV2;
    if (paused) {
      setError(getBondingErrorMessage('paused', locale));
      setStatus('error');
      return;
    }

    if (amountRaw == null || amountRaw <= 0n || termId == null) {
      setError(getBondingErrorMessage('invalid_amount', locale));
      setStatus('error');
      return;
    }

    setStatus('approving');
    setError(null);
    setWarning(null);
    setSuccess(null);

    try {
      await refetchConfig();
      const fresh = await freshQuote();
      if (!fresh || fresh.issues.length > 0) {
        setStatus('error');
        setError(getBondingErrorMessage('quote_issues', locale));
        return;
      }

      const approveAmount = resolveApproveAmountRaw({
        mode,
        inputAmountRaw: amountRaw,
        quoteWbtcAmountRaw: BigInt(fresh.wbtcAmountRaw),
      });

      const tokenAddress = side === 'buy' ? WBTC_ADDRESS : PRANA_ADDRESS;
      const spender =
        side === 'buy' ? BUY_BOND_ADDRESS_V2 : SELL_BOND_ADDRESS_V2;

      const action: BondingTransactionActionSnapshot = {
        kind: 'approve',
        side,
        amountRaw: approveAmount.toString(),
      };

      const walletClient = await ensurePolygonWalletClient();

      const outcome = await submitBondWriteFlow({
        refetchAccount,
        validateFreshAccount: (freshAccount) => {
          const nextAllowance = currentAllowanceRaw(freshAccount, side);
          if (mode === 'buy_target_prana') {
            // Still need the exact-cap approve path when surplus exists.
            return needsTargetPranaApproval({
              currentAllowanceRaw: nextAllowance,
              quoteWbtcAmountRaw: BigInt(fresh.wbtcAmountRaw),
              sessionApprovedCapRaw:
                sessionApprovedCapRaw != null
                  ? BigInt(sessionApprovedCapRaw)
                  : null,
            });
          }
          return needsExactInputApproval(nextAllowance, amountRaw);
        },
        simulate: async () => {
          const request = await publicClient!.simulateContract({
            account: wallet.address!,
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [spender, approveAmount],
            chain: polygon,
          });
          return {
            address: tokenAddress,
            functionName: 'approve',
            args: [spender, approveAmount] as const,
            account: wallet.address!,
            request,
          };
        },
        write: async (simulated) => {
          const request = (simulated as { request?: unknown }).request;
          if (request) {
            return walletClient.writeContract(request as never);
          }
          return walletClient.writeContract({
            chain: polygon,
            account: simulated.account,
            address: simulated.address,
            abi: erc20Abi,
            functionName: 'approve',
            args: simulated.args as [Address, bigint],
          } as never);
        },
        waitForReceipt: async (hash) => {
          setPending({ hash, action });
          setTransactionHash(hash);
          setStatus('confirming');
          return publicClient!.waitForTransactionReceipt({ hash });
        },
        confirmOnServer: (hash) =>
          confirmBondingTransactionOnServer({
            transactionHash: hash,
            account: wallet.address!,
            action,
          }),
      });

      if (outcome.kind === 'fresh_account_failed') {
        setStatus('error');
        setError(getBondingErrorMessage('account_refetch_failed', locale));
        return;
      }
      if (outcome.kind === 'validation_failed') {
        // Allowance became sufficient mid-flight — fall through to review.
        setPending(null);
        setStatus('idle');
        return;
      }
      if (outcome.kind === 'simulate_failed') {
        setPending(null);
        setStatus('error');
        setError(getBondingErrorMessage('simulate_failed', locale));
        return;
      }
      if (outcome.kind === 'rejected_before_broadcast') {
        setPending(null);
        setStatus('error');
        setError(formatBondingError(outcome.error, locale));
        return;
      }
      if (outcome.kind === 'confirmation_unavailable') {
        setPending({ hash: outcome.hash, action });
        setTransactionHash(outcome.hash);
        setStatus('confirmation_unavailable');
        setError(copy.confirmationUnavailable);
        return;
      }
      if (outcome.kind === 'reverted') {
        setPending(null);
        setTransactionHash(null);
        setStatus('error');
        setError(getBondingErrorMessage('reverted', locale));
        return;
      }

      // Approve confirmed — ready for Review (separate click).
      setPending(null);
      setTransactionHash(outcome.hash);
      if (mode === 'buy_target_prana') {
        setSessionApprovedCapRaw(approveAmount.toString());
      }
      setStatus('idle');
      setError(null);
      setSuccess(null);
      setWarning(outcome.syncFailed ? copy.accountSyncWarning : null);
    } catch (err) {
      setPending(null);
      setStatus('error');
      setError(formatBondingError(err, locale));
    }
  }, [
    amountRaw,
    config,
    copy.accountSyncWarning,
    copy.confirmationUnavailable,
    ensurePolygonWalletClient,
    freshQuote,
    locale,
    mode,
    publicClient,
    refetchAccount,
    refetchConfig,
    sessionApprovedCapRaw,
    side,
    termId,
    wallet.address,
    wallet.isConnected,
  ]);

  const openReview = useCallback(async () => {
    if (!wallet.isConnected || !wallet.address) {
      setError(getBondingErrorMessage('not_connected', locale));
      setStatus('error');
      return;
    }
    if (!config) {
      setError(getBondingErrorMessage('generic', locale));
      setStatus('error');
      return;
    }

    const paused =
      side === 'buy' ? config.paused.buyV2 : config.paused.sellV2;
    if (paused) {
      setError(getBondingErrorMessage('paused', locale));
      setStatus('error');
      return;
    }

    if (amountRaw == null || termId == null) {
      setError(getBondingErrorMessage('invalid_amount', locale));
      setStatus('error');
      return;
    }

    if (!getConfiguredTerm(
      side === 'buy' ? config.buyTerms : config.sellTerms,
      termId,
    )) {
      setError(getBondingErrorMessage('invalid_term', locale));
      setStatus('error');
      return;
    }

    setStatus('reviewing');
    setError(null);
    setWarning(null);
    setSuccess(null);

    try {
      await refetchConfig();
      const accountSnap = accountFromSuccessfulRefetch(
        await refetchAccount(),
        wallet.address,
      );
      if (!accountSnap) {
        setStatus('error');
        setError(getBondingErrorMessage('account_refetch_failed', locale));
        return;
      }

      const fresh = await freshQuote();
      if (!fresh || fresh.issues.length > 0) {
        setStatus('error');
        setError(getBondingErrorMessage('quote_issues', locale));
        return;
      }

      const nextAllowance = currentAllowanceRaw(accountSnap, side);
      if (
        !isAllowanceSufficientForCreate({
          mode,
          currentAllowanceRaw: nextAllowance,
          inputAmountRaw: amountRaw,
          quoteWbtcAmountRaw: BigInt(fresh.wbtcAmountRaw),
        })
      ) {
        // Fresh quote exceeded cap — back to Approve (no wallet prompt here).
        setReviewOpen(false);
        setReviewQuote(null);
        setStatus('idle');
        setError(getBondingErrorMessage('insufficient_allowance', locale));
        return;
      }

      // Review is an in-app dialog only — never opens the wallet.
      setReviewQuote(fresh);
      setReviewOpen(true);
      setStatus('reviewing');
    } catch (err) {
      setStatus('error');
      setError(formatBondingError(err, locale));
    }
  }, [
    amountRaw,
    config,
    freshQuote,
    locale,
    mode,
    refetchAccount,
    refetchConfig,
    side,
    termId,
    wallet.address,
    wallet.isConnected,
  ]);

  const runCreate = useCallback(async () => {
    if (!wallet.isConnected || !wallet.address) {
      setError(getBondingErrorMessage('not_connected', locale));
      setStatus('error');
      return;
    }
    if (!config || amountRaw == null || termId == null) {
      setError(getBondingErrorMessage('generic', locale));
      setStatus('error');
      return;
    }

    const paused =
      side === 'buy' ? config.paused.buyV2 : config.paused.sellV2;
    if (paused) {
      setError(getBondingErrorMessage('paused', locale));
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setError(null);
    setWarning(null);
    setSuccess(null);

    try {
      await refetchConfig();
      const fresh = await freshQuote();
      if (!fresh || fresh.issues.length > 0) {
        setStatus('reviewing');
        setError(getBondingErrorMessage('quote_issues', locale));
        return;
      }

      // Update dialog numbers if quote moved but still executable.
      setReviewQuote(fresh);

      const createAmountRaw =
        mode === 'buy_target_prana'
          ? BigInt(fresh.pranaAmountRaw)
          : mode === 'buy_exact_wbtc'
            ? BigInt(fresh.wbtcAmountRaw)
            : BigInt(fresh.pranaAmountRaw);

      // Target PRANA: if quote WBTC exceeds allowance cap → Approve again.
      const accountSnap = accountFromSuccessfulRefetch(
        await refetchAccount(),
        wallet.address,
      );
      if (!accountSnap) {
        setStatus('error');
        setError(getBondingErrorMessage('account_refetch_failed', locale));
        return;
      }

      const nextAllowance = currentAllowanceRaw(accountSnap, side);
      if (
        !isAllowanceSufficientForCreate({
          mode,
          currentAllowanceRaw: nextAllowance,
          inputAmountRaw: amountRaw,
          quoteWbtcAmountRaw: BigInt(fresh.wbtcAmountRaw),
        })
      ) {
        setReviewOpen(false);
        setReviewQuote(null);
        setStatus('idle');
        setError(getBondingErrorMessage('insufficient_allowance', locale));
        return;
      }

      const bondAddress =
        side === 'buy' ? BUY_BOND_ADDRESS_V2 : SELL_BOND_ADDRESS_V2;
      const bondAbi = side === 'buy' ? BUY_BOND_V2_ABI : SELL_BOND_V2_ABI;

      let functionName: string;
      let args: readonly unknown[];
      if (mode === 'buy_exact_wbtc') {
        functionName = 'buyBondForWbtcAmount';
        args = [createAmountRaw, termId];
      } else if (mode === 'buy_target_prana') {
        functionName = 'buyBondForPranaAmount';
        args = [createAmountRaw, termId];
      } else {
        functionName = 'sellBond';
        args = [createAmountRaw, termId];
      }

      const action: BondingTransactionActionSnapshot = {
        kind: 'create',
        side,
        version: 'v2',
        mode,
        amountRaw: createAmountRaw.toString(),
        termId,
      };

      const walletClient = await ensurePolygonWalletClient();

      const outcome = await submitBondWriteFlow({
        refetchAccount,
        validateFreshAccount: (freshAccount) => {
          const allow = currentAllowanceRaw(freshAccount, side);
          return isAllowanceSufficientForCreate({
            mode,
            currentAllowanceRaw: allow,
            inputAmountRaw: amountRaw,
            quoteWbtcAmountRaw: BigInt(fresh.wbtcAmountRaw),
          });
        },
        simulate: async () => {
          const request = await publicClient!.simulateContract({
            account: wallet.address!,
            address: bondAddress,
            abi: bondAbi,
            functionName,
            args,
            chain: polygon,
          } as never);
          return {
            address: bondAddress,
            functionName,
            args,
            account: wallet.address!,
            request,
          };
        },
        write: async (simulated) => {
          // Once we have a hash path, never broadcast twice — write runs once.
          const request = (simulated as { request?: unknown }).request;
          if (request) {
            return walletClient.writeContract(request as never);
          }
          return walletClient.writeContract({
            chain: polygon,
            account: simulated.account,
            address: simulated.address,
            abi: bondAbi,
            functionName: simulated.functionName,
            args: simulated.args,
          } as never);
        },
        waitForReceipt: async (hash) => {
          setPending({ hash, action });
          setTransactionHash(hash);
          setReviewOpen(false);
          setStatus('confirming');
          return publicClient!.waitForTransactionReceipt({ hash });
        },
        confirmOnServer: (hash) =>
          confirmBondingTransactionOnServer({
            transactionHash: hash,
            account: wallet.address!,
            action,
          }),
      });

      if (outcome.kind === 'fresh_account_failed') {
        setStatus('error');
        setError(getBondingErrorMessage('account_refetch_failed', locale));
        return;
      }
      if (outcome.kind === 'validation_failed') {
        setReviewOpen(false);
        setStatus('idle');
        setError(getBondingErrorMessage('insufficient_allowance', locale));
        return;
      }
      if (outcome.kind === 'simulate_failed') {
        setStatus('reviewing');
        setReviewOpen(true);
        setError(getBondingErrorMessage('simulate_failed', locale));
        return;
      }
      if (outcome.kind === 'rejected_before_broadcast') {
        setStatus('reviewing');
        setReviewOpen(true);
        setError(formatBondingError(outcome.error, locale));
        return;
      }
      if (outcome.kind === 'confirmation_unavailable') {
        setPending({ hash: outcome.hash, action });
        setTransactionHash(outcome.hash);
        setReviewOpen(false);
        setStatus('confirmation_unavailable');
        setError(copy.confirmationUnavailable);
        return;
      }
      if (outcome.kind === 'reverted') {
        setPending(null);
        setTransactionHash(null);
        setReviewOpen(false);
        setStatus('error');
        setError(getBondingErrorMessage('reverted', locale));
        return;
      }

      applyConfirmed(outcome.hash, outcome.syncFailed);
    } catch (err) {
      setStatus('error');
      setError(formatBondingError(err, locale));
    }
  }, [
    amountRaw,
    applyConfirmed,
    config,
    copy.confirmationUnavailable,
    ensurePolygonWalletClient,
    freshQuote,
    locale,
    mode,
    publicClient,
    refetchAccount,
    refetchConfig,
    side,
    termId,
    wallet.address,
    wallet.isConnected,
  ]);

  /** Primary CTA: resume / approve / open review — never auto-create. */
  const onPrimaryCta = useCallback(async () => {
    clearMessages();

    const pendingHash =
      pending != null && status !== 'success' ? pending : null;

    const action = resolveBondCtaAction({
      hasPendingHash: pendingHash != null,
      needsApproval,
      createRequested: false,
    });

    if (action !== 'resume_confirmation' && status === 'success') {
      setPending(null);
      setSuccess(null);
    }

    await runBondCtaBranch({
      action,
      resumeConfirmation: async () => {
        if (!pendingHash) return;
        await resumeConfirmReceipt(pendingHash);
      },
      runApprove,
      openReview,
      runCreate: async () => {
        // Create only from the review dialog confirm button.
      },
    });
  }, [
    clearMessages,
    needsApproval,
    openReview,
    pending,
    resumeConfirmReceipt,
    runApprove,
    status,
  ]);

  /** Dialog confirm → create bond (second wallet prompt, separate click). */
  const onConfirmCreate = useCallback(async () => {
    clearMessages();
    if (pending != null && status !== 'success') {
      await resumeConfirmReceipt(pending);
      return;
    }
    await runCreate();
  }, [clearMessages, pending, resumeConfirmReceipt, runCreate, status]);

  const isBusy =
    status === 'approving' ||
    status === 'submitting' ||
    status === 'confirming';

  const hasPendingHash = pending != null && status !== 'success';

  return {
    status,
    error,
    warning,
    success,
    transactionHash,
    isBusy,
    needsApproval,
    hasPendingHash,
    reviewOpen,
    reviewQuote,
    onPrimaryCta,
    onConfirmCreate,
    closeReview,
    resetAfterSuccess,
    clearMessages,
  };
}
