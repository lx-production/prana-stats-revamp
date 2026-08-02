import { erc20Abi } from 'viem';
import { polygon } from 'wagmi/chains';
import { usePublicClient } from 'wagmi';
import { getBondingCopy } from '../bonding.copy.ts';
import { getConfiguredTerm } from '../utils/bondingMath.ts';
import { POLYGON_CHAIN_ID } from '../../../constants/network.ts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInjectedWallet } from '../../web3/useInjectedWallet.ts';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage.ts';
import { usePendingBondTransaction } from './usePendingBondTransaction.ts';
import { confirmBondingTransactionOnServer } from '../utils/bondingApi.ts';
import { accountFromSuccessfulRefetch } from '../../web3/accountRefetch.ts';
import { getPolygonWalletClient } from '../../web3/getPolygonWalletClient.ts';
import { PRANA_ADDRESS, WBTC_ADDRESS } from '../../../constants/sharedContracts.ts';
import { waitForPolygonWalletReceipt } from '../../web3/waitForPolygonWalletReceipt.ts';
import { isBondingQuoteEchoValid, resolveCreateAmountRaw } from '../utils/bondQuoteEcho.ts';
import { formatBondingError, getBondingErrorMessage, logBondingFailure } from '../utils/bondingErrors.ts';
import { BUY_BOND_ADDRESS_V2, BUY_BOND_V2_ABI, SELL_BOND_ADDRESS_V2, SELL_BOND_V2_ABI } from '../../../constants/bonds.ts';
import {
  buildPendingBondTransaction,
  pendingBondTransactionMatchesWallet,
} from '../utils/bondPendingTransactionStorage.ts';
import { isAllowanceSufficientForCreate, needsExactInputApproval, resolveApproveAmountRaw } from '../utils/bondAllowance.ts';
import { confirmBondReceipt, resolveBondCtaAction, runBondCtaBranch, submitBondWriteFlow } from '../utils/bondTransactionFlow.ts';

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
  PendingBondTransaction,
} from '../bonding.types.ts';

const FORM_PENDING_KINDS = ['approve', 'create'] as const;

type UseBondTransactionInput = {
  config: BondingConfig | undefined;
  account: BondingAccount | undefined;
  side: BondSide;
  amountRaw: bigint | null;
  termId: BondTermId | null;
  /** Live quote used for allowance checks; create uses a fresh quote. */
  quote: BondingQuote | null;
  freshQuote: () => Promise<BondingQuote | null>;
  refetchAccount: () => Promise<unknown>;
  refetchConfig: () => Promise<unknown>;
};

function quoteModeFor(side: BondSide): BondingQuoteMode {
  return side === 'sell' ? 'sell_exact_prana' : 'buy_exact_wbtc';
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
 * Approve → Create Bond → Confirming.
 * Max two wallet prompts on separate clicks; never auto-chain approve+create.
 */
export function useBondTransaction({
  config,
  account,
  side,
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
  /** Last hash to show on Polygonscan (success or pending). */
  const [transactionHash, setTransactionHash] = useState<Hex | null>(null);

  const {
    pending,
    pendingLoaded,
    rememberPending,
    clearPendingRecord,
    discardLocalPending,
  } = usePendingBondTransaction({
    account: wallet.address,
    chainId: wallet.chainId,
    kinds: FORM_PENDING_KINDS,
  });

  // Latest wallet identity for post-await guards (avoid stale closures).
  const walletIdentityRef = useRef({
    address: wallet.address,
    chainId: wallet.chainId,
  });
  walletIdentityRef.current = {
    address: wallet.address,
    chainId: wallet.chainId,
  };

  const mode = quoteModeFor(side);

  // Restore Polygonscan hash after reload / reconnect.
  useEffect(() => {
    if (!pendingLoaded || !pending) return;
    setTransactionHash(pending.hash);
  }, [pending, pendingLoaded]);

  const allowance = currentAllowanceRaw(account, side);

  const needsApproval = useMemo(() => {
    if (amountRaw == null || amountRaw <= 0n) return false;
    if (!quote || quote.issues.length > 0) return false;
    return needsExactInputApproval(allowance, amountRaw);
  }, [amountRaw, allowance, quote]);

  const clearMessages = useCallback(() => {
    setError(null);
    setWarning(null);
    setSuccess(null);
  }, []);

  const resetAfterSuccess = useCallback(() => {
    setStatus('idle');
    clearPendingRecord();
    setTransactionHash(null);
  }, [clearPendingRecord]);

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
    (hash: Hex, syncFailed: boolean, pendingTx?: PendingBondTransaction | null) => {
      clearPendingRecord(pendingTx ?? null);
      setTransactionHash(hash);
      setStatus('success');
      setError(null);
      setSuccess(copy.bondConfirmed);
      setWarning(syncFailed ? copy.accountSyncWarning : null);
    },
    [clearPendingRecord, copy.accountSyncWarning, copy.bondConfirmed],
  );

  const resumeConfirmReceipt = useCallback(
    async (pendingTx: PendingBondTransaction) => {
      if (
        !pendingBondTransactionMatchesWallet(
          pendingTx,
          wallet.address,
          wallet.chainId,
        )
      ) {
        return;
      }

      setStatus('confirming');
      setError(null);
      setWarning(null);

      const outcome = await confirmBondReceipt(pendingTx.hash, {
        requireServerValidation: true,
        waitForReceipt: waitForPolygonWalletReceipt,
        confirmOnServer: (txHash) =>
          confirmBondingTransactionOnServer({
            transactionHash: txHash,
            account: pendingTx.account,
            action: pendingTx.action,
          }),
        refetchAccount,
      });

      // Wallet switched mid-wait — keep storage for the original account.
      if (
        !pendingBondTransactionMatchesWallet(
          pendingTx,
          walletIdentityRef.current.address,
          walletIdentityRef.current.chainId,
        )
      ) {
        discardLocalPending();
        setStatus('idle');
        return;
      }

      if (outcome.kind === 'confirmed') {
        applyConfirmed(pendingTx.hash, outcome.syncFailed, pendingTx);
        return;
      }

      if (outcome.kind === 'reverted') {
        logBondingFailure('resume: reverted', { hash: pendingTx.hash });
        clearPendingRecord(pendingTx);
        setTransactionHash(null);
        setStatus('error');
        setError(getBondingErrorMessage('reverted', locale));
        return;
      }

      // Keep hash + snapshot; never treat as failed write.
      logBondingFailure('resume: confirmation_unavailable', {
        hash: pendingTx.hash,
        receiptError: outcome.receiptError,
        verificationError: outcome.verificationError,
      });
      rememberPending(pendingTx);
      setTransactionHash(pendingTx.hash);
      setStatus('confirmation_unavailable');
      setError(copy.confirmationUnavailable);
    },
    [
      applyConfirmed,
      clearPendingRecord,
      copy.confirmationUnavailable,
      discardLocalPending,
      locale,
      refetchAccount,
      rememberPending,
      wallet.address,
      wallet.chainId,
    ],
  );

  const runApprove = useCallback(async () => {
    if (!pendingLoaded || pending != null) return;

    if (!wallet.isConnected || !wallet.address) {
      logBondingFailure('approve: not_connected');
      setError(getBondingErrorMessage('not_connected', locale));
      setStatus('error');
      return;
    }
    if (!config) {
      logBondingFailure('approve: missing config');
      setError(getBondingErrorMessage('generic', locale));
      setStatus('error');
      return;
    }

    const paused =
      side === 'buy' ? config.paused.buyV2 : config.paused.sellV2;
    if (paused) {
      logBondingFailure('approve: paused', { side });
      setError(getBondingErrorMessage('paused', locale));
      setStatus('error');
      return;
    }

    if (amountRaw == null || amountRaw <= 0n || termId == null) {
      logBondingFailure('approve: invalid_amount', {
        amountRaw: amountRaw?.toString() ?? null,
        termId,
      });
      setError(getBondingErrorMessage('invalid_amount', locale));
      setStatus('error');
      return;
    }

    // Capture identity before wallet prompts — may change mid-flight.
    const submittingAccount = wallet.address as Address;

    setStatus('approving');
    setError(null);
    setWarning(null);
    setSuccess(null);

    // Breadcrumb: how far approve got before failing.
    console.info('[bonding] approve:start', {
      side,
      mode,
      amountRaw: amountRaw.toString(),
      termId,
      account: submittingAccount,
    });

    try {
      await refetchConfig();
      const fresh = await freshQuote();
      if (!fresh || fresh.issues.length > 0) {
        logBondingFailure('approve: quote_issues', fresh);
        setStatus('error');
        setError(getBondingErrorMessage('quote_issues', locale));
        return;
      }

      // Reject mismatched echo before any wallet prompt (race/regression guard).
      if (
        !isBondingQuoteEchoValid({
          quote: fresh,
          mode,
          termId,
          formInputRaw: amountRaw,
        })
      ) {
        logBondingFailure('approve: quote_echo_mismatch', {
          mode,
          termId,
          formInputRaw: amountRaw.toString(),
          quoteMode: fresh.mode,
          quoteTermId: fresh.termId,
          quoteWbtc: fresh.wbtcAmountRaw,
          quotePrana: fresh.pranaAmountRaw,
        });
        setStatus('error');
        setError(getBondingErrorMessage('quote_issues', locale));
        return;
      }

      const approveAmount = resolveApproveAmountRaw(amountRaw);

      const tokenAddress = side === 'buy' ? WBTC_ADDRESS : PRANA_ADDRESS;
      const spender =
        side === 'buy' ? BUY_BOND_ADDRESS_V2 : SELL_BOND_ADDRESS_V2;

      console.info('[bonding] approve:write-prep', {
        tokenAddress,
        spender,
        approveAmount: approveAmount.toString(),
        quoteWbtc: fresh.wbtcAmountRaw,
        quotePrana: fresh.pranaAmountRaw,
      });

      const action: BondingTransactionActionSnapshot = {
        kind: 'approve',
        side,
        amountRaw: approveAmount.toString(),
      };

      const walletClient = await ensurePolygonWalletClient();
      let broadcastPending: PendingBondTransaction | null = null;

      // Approve skips simulateContract — wallet gas estimation is enough.
      const outcome = await submitBondWriteFlow({
        refetchAccount,
        validateFreshAccount: (freshAccount) => {
          const nextAllowance = currentAllowanceRaw(freshAccount, side);
          return needsExactInputApproval(nextAllowance, amountRaw);
        },
        write: async () =>
          walletClient.writeContract({
            chain: polygon,
            account: submittingAccount,
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [spender, approveAmount],
          } as never),
        waitForReceipt: async (hash) => {
          broadcastPending = buildPendingBondTransaction({
            account: submittingAccount,
            chainId: POLYGON_CHAIN_ID,
            hash,
            action,
          });
          rememberPending(broadcastPending);
          setTransactionHash(hash);
          setStatus('confirming');
          return waitForPolygonWalletReceipt(hash);
        },
        confirmOnServer: (hash) =>
          confirmBondingTransactionOnServer({
            transactionHash: hash,
            account: submittingAccount,
            action,
          }),
      });

      // Wallet switched after broadcast — keep storage, hide local success.
      if (
        broadcastPending &&
        !pendingBondTransactionMatchesWallet(
          broadcastPending,
          walletIdentityRef.current.address,
          walletIdentityRef.current.chainId,
        )
      ) {
        discardLocalPending();
        setStatus('idle');
        return;
      }

      if (outcome.kind === 'fresh_account_failed') {
        logBondingFailure('approve: fresh_account_failed');
        setStatus('error');
        setError(getBondingErrorMessage('account_refetch_failed', locale));
        return;
      }
      if (outcome.kind === 'validation_failed') {
        // Allowance became sufficient mid-flight — ready for Create.
        console.info('[bonding] approve: validation_failed (allowance ok)');
        clearPendingRecord(broadcastPending);
        setStatus('idle');
        return;
      }
      if (outcome.kind === 'rejected_before_broadcast') {
        // formatBondingError already logs the classified code + raw error.
        clearPendingRecord(broadcastPending);
        setStatus('error');
        setError(formatBondingError(outcome.error, locale));
        return;
      }
      if (outcome.kind === 'confirmation_unavailable') {
        logBondingFailure('approve: confirmation_unavailable', {
          hash: outcome.hash,
          receiptError: outcome.receiptError,
          verificationError: outcome.verificationError,
        });
        const pendingTx =
          broadcastPending ??
          buildPendingBondTransaction({
            account: submittingAccount,
            chainId: POLYGON_CHAIN_ID,
            hash: outcome.hash,
            action,
          });
        rememberPending(pendingTx);
        setTransactionHash(outcome.hash);
        setStatus('confirmation_unavailable');
        setError(copy.confirmationUnavailable);
        return;
      }
      if (outcome.kind === 'reverted') {
        logBondingFailure('approve: reverted', {
          hash: outcome.hash,
          source: outcome.source,
        });
        clearPendingRecord(broadcastPending);
        setTransactionHash(null);
        setStatus('error');
        setError(getBondingErrorMessage('reverted', locale));
        return;
      }

      // Approve confirmed — ready for Create (separate click).
      console.info('[bonding] approve:confirmed', {
        hash: outcome.hash,
        syncFailed: outcome.syncFailed,
      });
      clearPendingRecord(broadcastPending);
      setTransactionHash(outcome.hash);
      setStatus('idle');
      setError(null);
      setSuccess(null);
      setWarning(outcome.syncFailed ? copy.accountSyncWarning : null);
    } catch (err) {
      clearPendingRecord();
      setStatus('error');
      setError(formatBondingError(err, locale));
    }
  }, [
    amountRaw,
    clearPendingRecord,
    config,
    copy.accountSyncWarning,
    copy.confirmationUnavailable,
    discardLocalPending,
    ensurePolygonWalletClient,
    freshQuote,
    locale,
    mode,
    pending,
    pendingLoaded,
    publicClient,
    refetchAccount,
    refetchConfig,
    rememberPending,
    side,
    termId,
    wallet.address,
    wallet.isConnected,
  ]);

  const runCreate = useCallback(async () => {
    if (!pendingLoaded || pending != null) return;

    if (!wallet.isConnected || !wallet.address) {
      logBondingFailure('create: not_connected');
      setError(getBondingErrorMessage('not_connected', locale));
      setStatus('error');
      return;
    }
    if (!config || amountRaw == null || termId == null) {
      logBondingFailure('create: missing config/amount/term', {
        hasConfig: Boolean(config),
        amountRaw: amountRaw?.toString() ?? null,
        termId,
      });
      setError(getBondingErrorMessage('generic', locale));
      setStatus('error');
      return;
    }

    const paused =
      side === 'buy' ? config.paused.buyV2 : config.paused.sellV2;
    if (paused) {
      logBondingFailure('create: paused', { side });
      setError(getBondingErrorMessage('paused', locale));
      setStatus('error');
      return;
    }

    if (!getConfiguredTerm(
      side === 'buy' ? config.buyTerms : config.sellTerms,
      termId,
    )) {
      logBondingFailure('create: invalid_term', { side, termId });
      setError(getBondingErrorMessage('invalid_term', locale));
      setStatus('error');
      return;
    }

    // Capture identity before wallet prompts — may change mid-flight.
    const submittingAccount = wallet.address as Address;

    setStatus('submitting');
    setError(null);
    setWarning(null);
    setSuccess(null);

    console.info('[bonding] create:start', {
      side,
      mode,
      amountRaw: amountRaw.toString(),
      termId,
    });

    try {
      await refetchConfig();
      const fresh = await freshQuote();
      if (!fresh || fresh.issues.length > 0) {
        logBondingFailure('create: quote_issues', fresh);
        setStatus('error');
        setError(getBondingErrorMessage('quote_issues', locale));
        return;
      }

      // Echo must match the locked form input before we build calldata.
      if (
        !isBondingQuoteEchoValid({
          quote: fresh,
          mode,
          termId,
          formInputRaw: amountRaw,
        })
      ) {
        logBondingFailure('create: quote_echo_mismatch', {
          mode,
          termId,
          formInputRaw: amountRaw.toString(),
          quoteMode: fresh.mode,
          quoteTermId: fresh.termId,
          quoteWbtc: fresh.wbtcAmountRaw,
          quotePrana: fresh.pranaAmountRaw,
        });
        setStatus('error');
        setError(getBondingErrorMessage('quote_issues', locale));
        return;
      }

      // Calldata input from form snapshot — never the quote response leg.
      const createAmountRaw = resolveCreateAmountRaw(amountRaw);

      const accountSnap = accountFromSuccessfulRefetch<BondingAccount>(
        await refetchAccount(),
        submittingAccount,
      );
      if (!accountSnap) {
        logBondingFailure('create: fresh_account_failed');
        setStatus('error');
        setError(getBondingErrorMessage('account_refetch_failed', locale));
        return;
      }

      const nextAllowance = currentAllowanceRaw(accountSnap, side);
      if (!isAllowanceSufficientForCreate(nextAllowance, amountRaw)) {
        logBondingFailure('create: insufficient_allowance', {
          nextAllowance: nextAllowance.toString(),
          amountRaw: amountRaw.toString(),
        });
        setStatus('idle');
        setError(getBondingErrorMessage('insufficient_allowance', locale));
        return;
      }

      const bondAddress =
        side === 'buy' ? BUY_BOND_ADDRESS_V2 : SELL_BOND_ADDRESS_V2;
      const bondAbi = side === 'buy' ? BUY_BOND_V2_ABI : SELL_BOND_V2_ABI;

      const functionName =
        mode === 'buy_exact_wbtc' ? 'buyBondForWbtcAmount' : 'sellBond';
      const args = [createAmountRaw, termId] as const;

      console.info('[bonding] create:write-prep', {
        bondAddress,
        functionName,
        createAmountRaw: createAmountRaw.toString(),
        termId,
      });

      const action: BondingTransactionActionSnapshot = {
        kind: 'create',
        side,
        version: 'v2',
        mode,
        amountRaw: createAmountRaw.toString(),
        termId,
      };

      const walletClient = await ensurePolygonWalletClient();
      let broadcastPending: PendingBondTransaction | null = null;

      const outcome = await submitBondWriteFlow({
        refetchAccount,
        validateFreshAccount: (freshAccount) => {
          const allow = currentAllowanceRaw(freshAccount, side);
          return isAllowanceSufficientForCreate(allow, amountRaw);
        },
        simulate: async () => {
          // viem returns { result, request } — only `request` is writeContract-ready.
          const { request } = await publicClient!.simulateContract({
            account: submittingAccount,
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
            account: submittingAccount,
            request,
          };
        },
        write: async (simulated) => {
          // Create always simulates first — prefer the writeContract-ready request.
          if (simulated?.request) {
            return walletClient.writeContract(simulated.request as never);
          }
          return walletClient.writeContract({
            chain: polygon,
            account: submittingAccount,
            address: bondAddress,
            abi: bondAbi,
            functionName,
            args,
          } as never);
        },
        waitForReceipt: async (hash) => {
          broadcastPending = buildPendingBondTransaction({
            account: submittingAccount,
            chainId: POLYGON_CHAIN_ID,
            hash,
            action,
          });
          rememberPending(broadcastPending);
          setTransactionHash(hash);
          setStatus('confirming');
          return waitForPolygonWalletReceipt(hash);
        },
        confirmOnServer: (hash) =>
          confirmBondingTransactionOnServer({
            transactionHash: hash,
            account: submittingAccount,
            action,
          }),
      });

      // Wallet switched after broadcast — keep storage, hide local success.
      if (
        broadcastPending &&
        !pendingBondTransactionMatchesWallet(
          broadcastPending,
          walletIdentityRef.current.address,
          walletIdentityRef.current.chainId,
        )
      ) {
        discardLocalPending();
        setStatus('idle');
        return;
      }

      if (outcome.kind === 'fresh_account_failed') {
        logBondingFailure('create: fresh_account_failed');
        setStatus('error');
        setError(getBondingErrorMessage('account_refetch_failed', locale));
        return;
      }
      if (outcome.kind === 'validation_failed') {
        logBondingFailure('create: validation_failed (allowance)');
        setStatus('idle');
        setError(getBondingErrorMessage('insufficient_allowance', locale));
        return;
      }
      if (outcome.kind === 'simulate_failed') {
        logBondingFailure('create: simulate_failed', outcome.error);
        setStatus('error');
        setError(getBondingErrorMessage('simulate_failed', locale));
        return;
      }
      if (outcome.kind === 'rejected_before_broadcast') {
        setStatus('error');
        setError(formatBondingError(outcome.error, locale));
        return;
      }
      if (outcome.kind === 'confirmation_unavailable') {
        logBondingFailure('create: confirmation_unavailable', {
          hash: outcome.hash,
          receiptError: outcome.receiptError,
          verificationError: outcome.verificationError,
        });
        const pendingTx =
          broadcastPending ??
          buildPendingBondTransaction({
            account: submittingAccount,
            chainId: POLYGON_CHAIN_ID,
            hash: outcome.hash,
            action,
          });
        rememberPending(pendingTx);
        setTransactionHash(outcome.hash);
        setStatus('confirmation_unavailable');
        setError(copy.confirmationUnavailable);
        return;
      }
      if (outcome.kind === 'reverted') {
        logBondingFailure('create: reverted', {
          hash: outcome.hash,
          source: outcome.source,
        });
        clearPendingRecord(broadcastPending);
        setTransactionHash(null);
        setStatus('error');
        setError(getBondingErrorMessage('reverted', locale));
        return;
      }

      applyConfirmed(outcome.hash, outcome.syncFailed, broadcastPending);
    } catch (err) {
      setStatus('error');
      setError(formatBondingError(err, locale));
    }
  }, [
    amountRaw,
    applyConfirmed,
    clearPendingRecord,
    config,
    copy.confirmationUnavailable,
    discardLocalPending,
    ensurePolygonWalletClient,
    freshQuote,
    locale,
    mode,
    pending,
    pendingLoaded,
    publicClient,
    refetchAccount,
    refetchConfig,
    rememberPending,
    side,
    termId,
    wallet.address,
    wallet.isConnected,
  ]);

  /** Primary CTA: resume / approve / create — never auto-chain approve+create. */
  const onPrimaryCta = useCallback(async () => {
    clearMessages();

    const pendingHash =
      pending != null && status !== 'success' ? pending : null;

    const action = resolveBondCtaAction({
      hasPendingHash: pendingHash != null,
      needsApproval,
    });

    if (action !== 'resume_confirmation' && status === 'success') {
      setSuccess(null);
    }

    await runBondCtaBranch({
      action,
      resumeConfirmation: async () => {
        if (!pendingHash) return;
        await resumeConfirmReceipt(pendingHash);
      },
      runApprove,
      runCreate,
    });
  }, [
    clearMessages,
    needsApproval,
    pending,
    resumeConfirmReceipt,
    runApprove,
    runCreate,
    status,
  ]);

  const hasPendingHash = pending != null && status !== 'success';

  // Own work only — parent cross-locks via onBusyChange, not externallyBusy echo.
  const isBusy =
    !pendingLoaded ||
    status === 'approving' ||
    status === 'submitting' ||
    status === 'confirming' ||
    hasPendingHash;

  return {
    status,
    error,
    warning,
    success,
    transactionHash,
    isBusy,
    needsApproval,
    hasPendingHash,
    pendingLoaded,
    onPrimaryCta,
    resetAfterSuccess,
    clearMessages,
  };
}
