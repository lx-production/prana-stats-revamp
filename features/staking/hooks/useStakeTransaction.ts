import { parseSignature } from 'viem';
import { polygon } from 'wagmi/chains';
import { usePublicClient } from 'wagmi';
import { getStakingCopy } from '../staking.copy.ts';
import { getConfiguredDuration } from '../utils/stakingMath.ts';
import { isPermitSnapshotValid } from '../utils/permitUtils.ts';
import { POLYGON_CHAIN_ID } from '../../../constants/network.ts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useInjectedWallet } from '../../web3/useInjectedWallet.ts';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage.ts';
import { confirmStakingTransactionOnServer } from '../utils/stakingApi.ts';
import { accountFromSuccessfulRefetch } from '../../web3/accountRefetch.ts';
import { usePendingStakeTransaction } from './usePendingStakeTransaction.ts';
import { getPolygonWalletClient } from '../../web3/getPolygonWalletClient.ts';
import { waitForPolygonWalletReceipt } from '../../web3/waitForPolygonWalletReceipt.ts';
import { formatStakingError, getStakingErrorMessage, logStakingFailure } from '../utils/stakingErrors.ts';
import { buildPendingStakeTransaction, pendingStakeTransactionMatchesWallet } from '../utils/stakePendingTransactionStorage.ts';
import { confirmStakeReceipt, runPermitThenStake, resolvePermitAndStakeAction, submitStakeWithPermitFlow } from '../utils/stakeTransactionFlow.ts';
import { PERMIT_DEADLINE_SECONDS, PRANA_PERMIT_TYPES, STAKING_CONTRACT_ABI, STAKING_CONTRACT_ADDRESS } from '../../../constants/stakingContracts.ts';

import type { Hex } from '../../../types/blockchain.types.ts';
import type { PendingStakeTransaction, PermitSnapshot, StakeTransactionStatus, StakingAccountSnapshot, StakingConfig, StakingQuote, StakingTransactionActionSnapshot } from '../staking.types.ts';

const FORM_PENDING_KINDS = ['stake'] as const;

type UseStakeTransactionInput = {
  config: StakingConfig | undefined;
  account: StakingAccountSnapshot | undefined;
  amountRaw: bigint | null;
  durationSeconds: number | null;
  /** Refetch account before signing/submit (fresh nonce) and after success. */
  refetchAccount: () => Promise<unknown>;
  /**
   * Live Interest-fund preflight (same-block raw bigint).
   * Called immediately before Permit sign and before stake broadcast.
   */
  freshQuote: () => Promise<StakingQuote | null>;
};

/** Map quote soft-issues to a UI error code (fund check is the primary gate). */
function errorCodeFromQuoteIssues(
  issues: StakingQuote['issues'],
):
  | 'paused'
  | 'below_min'
  | 'invalid_duration'
  | 'invalid_amount'
  | 'insufficient_interest_fund'
  | 'generic' {
  if (issues.includes('insufficient_interest_fund')) {
    return 'insufficient_interest_fund';
  }
  if (issues.includes('paused')) return 'paused';
  if (issues.includes('below_minimum')) return 'below_min';
  if (issues.includes('invalid_duration')) return 'invalid_duration';
  if (issues.includes('zero_amount')) return 'invalid_amount';
  return 'generic';
}

/** Build the confirm-transaction action snapshot from a signed permit. */
function stakeActionFromPermit(
  snapshot: PermitSnapshot,
): StakingTransactionActionSnapshot {
  return {
    kind: 'stake',
    amountRaw: snapshot.amountRaw,
    durationSeconds: snapshot.durationSeconds,
    deadline: snapshot.deadline,
    v: snapshot.v,
    r: snapshot.r,
    s: snapshot.s,
  };
}

/**
 * Combined Permit & Stake flow.
 * createPermitSnapshot returns the snapshot directly so submit can run in the
 * same turn without waiting for React state to flush.
 */
export function useStakeTransaction({
  config,
  account,
  amountRaw,
  durationSeconds,
  refetchAccount,
  freshQuote,
}: UseStakeTransactionInput) {
  const { locale } = useSiteLanguage();
  const copy = getStakingCopy(locale);
  const wallet = useInjectedWallet();
  const publicClient = usePublicClient({ chainId: POLYGON_CHAIN_ID });

  const [permit, setPermit] = useState<PermitSnapshot | null>(null);
  const [status, setStatus] = useState<StakeTransactionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<Hex | null>(null);
  const [nowSeconds, setNowSeconds] = useState(() =>
    Math.floor(Date.now() / 1000),
  );

  const {
    pending,
    pendingLoaded,
    rememberPending,
    clearPendingRecord,
    discardLocalPending,
  } = usePendingStakeTransaction({
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

  // Restore Polygonscan hash after reload / reconnect.
  useEffect(() => {
    if (!pendingLoaded || !pending) return;
    setTransactionHash(pending.hash);
  }, [pending, pendingLoaded]);

  // Tick so expired permits invalidate without waiting for user action.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const amountRawString = amountRaw != null ? amountRaw.toString() : '';

  // Auto-clear permit when amount / duration / account / chain / nonce / deadline changes.
  useEffect(() => {
    if (!permit) return;

    const stillValid = isPermitSnapshotValid(permit, {
      owner: wallet.address,
      chainId: wallet.chainId,
      amountRaw: amountRawString,
      durationSeconds: durationSeconds ?? -1,
      nowSeconds,
      currentNonce: account?.permitNonce,
    });

    if (!stillValid) {
      setPermit(null);
      if (status === 'signed') setStatus('idle');
    }
  }, [
    permit,
    wallet.address,
    wallet.chainId,
    amountRawString,
    durationSeconds,
    nowSeconds,
    account?.permitNonce,
    status,
  ]);

  const clearMessages = useCallback(() => {
    setError(null);
    setWarning(null);
    setSuccess(null);
  }, []);

  const resetAfterSuccess = useCallback(() => {
    setPermit(null);
    setStatus('idle');
    clearPendingRecord();
    setTransactionHash(null);
  }, [clearPendingRecord]);

  /** Switch to Polygon first, then resolve a fresh wallet client. */
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
    (
      hash: Hex,
      syncFailed: boolean,
      pendingTx?: PendingStakeTransaction | null,
    ) => {
      clearPendingRecord(pendingTx ?? null);
      setTransactionHash(hash);
      setPermit(null);
      setStatus('success');
      setError(null);
      setSuccess(copy.stakeConfirmed);
      setWarning(syncFailed ? copy.accountSyncWarning : null);
    },
    [clearPendingRecord, copy.accountSyncWarning, copy.stakeConfirmed],
  );

  /**
   * Resume confirmation for an already-broadcast hash.
   * Never calls writeContract again. Resume always re-validates on the server.
   */
  const resumeConfirmReceipt = useCallback(
    async (pendingTx: PendingStakeTransaction) => {
      if (
        !pendingStakeTransactionMatchesWallet(
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

      const outcome = await confirmStakeReceipt(pendingTx.hash, {
        requireServerValidation: true,
        waitForReceipt: waitForPolygonWalletReceipt,
        confirmOnServer: (txHash) =>
          confirmStakingTransactionOnServer({
            transactionHash: txHash,
            account: pendingTx.account,
            action: pendingTx.action,
          }),
        refetchAccount,
      });

      // Wallet switched mid-wait — keep storage for the original account.
      if (
        !pendingStakeTransactionMatchesWallet(
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
        logStakingFailure('resume: reverted', { hash: pendingTx.hash });
        clearPendingRecord(pendingTx);
        setTransactionHash(null);
        setPermit(null);
        setStatus('error');
        setError(getStakingErrorMessage('reverted', locale));
        return;
      }

      // Keep hash + snapshot; never treat as failed write.
      logStakingFailure('resume: confirmation_unavailable', {
        hash: pendingTx.hash,
        receiptError: outcome.receiptError,
        verificationError: outcome.verificationError,
      });
      rememberPending(pendingTx);
      setTransactionHash(pendingTx.hash);
      setPermit(null);
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

  /**
   * Validate, require a successful account refetch, sign EIP-712, return snapshot.
   * Returns null on validation failure or user rejection (status/error already set).
   */
  const createPermitSnapshot =
    useCallback(async (): Promise<PermitSnapshot | null> => {
      if (!wallet.isConnected || !wallet.address) {
        setError(getStakingErrorMessage('not_connected', locale));
        setStatus('error');
        return null;
      }

      if (!config) {
        setError(getStakingErrorMessage('generic', locale));
        setStatus('error');
        return null;
      }

      if (config.paused) {
        setError(getStakingErrorMessage('paused', locale));
        setStatus('error');
        return null;
      }

      if (amountRaw == null || amountRaw <= 0n || durationSeconds == null) {
        setError(getStakingErrorMessage('invalid_amount', locale));
        setStatus('error');
        return null;
      }

      if (!getConfiguredDuration(config.durations, durationSeconds)) {
        setError(getStakingErrorMessage('invalid_duration', locale));
        setStatus('error');
        return null;
      }

      const minStakeRaw = BigInt(config.minStakeRaw);
      if (amountRaw < minStakeRaw) {
        setError(getStakingErrorMessage('below_min', locale));
        setStatus('error');
        return null;
      }

      try {
        // Re-check Interest fund on-chain right before asking for a Permit signature.
        const fundQuote = await freshQuote();
        if (!fundQuote) {
          setError(getStakingErrorMessage('quote_failed', locale));
          setStatus('error');
          return null;
        }
        if (fundQuote.issues.length > 0) {
          setError(
            getStakingErrorMessage(
              errorCodeFromQuoteIssues(fundQuote.issues),
              locale,
            ),
          );
          setStatus('error');
          return null;
        }

        setStatus('signing');
        const walletClient = await ensurePolygonWalletClient();

        // Must be a successful refetch — never fall back to cached nonce/balance.
        const accountSnapshot = accountFromSuccessfulRefetch<StakingAccountSnapshot>(
          await refetchAccount(),
          wallet.address,
        );

        if (!accountSnapshot) {
          setError(getStakingErrorMessage('account_refetch_failed', locale));
          setStatus('error');
          return null;
        }

        if (amountRaw > BigInt(accountSnapshot.balanceRaw)) {
          setError(getStakingErrorMessage('insufficient_balance', locale));
          setStatus('error');
          return null;
        }

        const deadline = Math.floor(Date.now() / 1000) + PERMIT_DEADLINE_SECONDS;
        const nonce = BigInt(accountSnapshot.permitNonce);

        const domain = {
          name: config.permitDomain.name,
          version: config.permitDomain.version,
          chainId: POLYGON_CHAIN_ID,
          verifyingContract: config.contracts.prana,
        };

        const message = {
          owner: wallet.address,
          spender: config.contracts.staking,
          value: amountRaw,
          nonce,
          deadline: BigInt(deadline),
        };

        const signature = await walletClient.signTypedData({
          account: wallet.address,
          domain,
          types: PRANA_PERMIT_TYPES,
          primaryType: 'Permit',
          message,
        } as never);

        const parsed = parseSignature(signature);

        const snapshot: PermitSnapshot = {
          owner: wallet.address,
          chainId: POLYGON_CHAIN_ID,
          nonce: nonce.toString(),
          amountRaw: amountRaw.toString(),
          durationSeconds,
          deadline,
          v: Number(parsed.v),
          r: parsed.r,
          s: parsed.s,
        };

        // Keep in state for "Continue Stake" if write is rejected before broadcast.
        setPermit(snapshot);
        setStatus('signed');
        return snapshot;
      } catch (err) {
        setPermit(null);
        setStatus('error');
        setError(formatStakingError(err, locale));
        return null;
      }
    }, [
      amountRaw,
      config,
      durationSeconds,
      ensurePolygonWalletClient,
      freshQuote,
      locale,
      refetchAccount,
      wallet.address,
      wallet.isConnected,
    ]);

  /**
   * Submit stakeWithPermit using an explicit snapshot.
   * Pre-broadcast failures keep the permit; post-broadcast keep the hash only.
   */
  const submitStakeWithPermit = useCallback(
    async (snapshot: PermitSnapshot) => {
      if (!wallet.isConnected || !wallet.address) {
        setError(getStakingErrorMessage('not_connected', locale));
        setStatus('error');
        return;
      }

      if (!config || config.paused) {
        setError(
          getStakingErrorMessage(config?.paused ? 'paused' : 'generic', locale),
        );
        setStatus('error');
        return;
      }

      if (!getConfiguredDuration(config.durations, snapshot.durationSeconds)) {
        setPermit(null);
        setError(getStakingErrorMessage('invalid_duration', locale));
        setStatus('error');
        return;
      }

      if (BigInt(snapshot.amountRaw) < BigInt(config.minStakeRaw)) {
        setPermit(null);
        setError(getStakingErrorMessage('below_min', locale));
        setStatus('error');
        return;
      }

      const action = stakeActionFromPermit(snapshot);

      try {
        // Re-check fund again before broadcast (covers Continue Stake + races).
        const fundQuote = await freshQuote();
        if (!fundQuote) {
          setError(getStakingErrorMessage('quote_failed', locale));
          setStatus('error');
          return;
        }
        if (fundQuote.issues.length > 0) {
          // Drop permit — position is no longer fundable under current reserves.
          setPermit(null);
          setError(
            getStakingErrorMessage(
              errorCodeFromQuoteIssues(fundQuote.issues),
              locale,
            ),
          );
          setStatus('error');
          return;
        }

        setStatus('submitting');
        const walletClient = await ensurePolygonWalletClient();

        const outcome = await submitStakeWithPermitFlow({
          refetchAccount,
          writeContract: async () =>
            walletClient.writeContract({
              chain: polygon,
              account: wallet.address!,
              address: STAKING_CONTRACT_ADDRESS,
              abi: STAKING_CONTRACT_ABI,
              functionName: 'stakeWithPermit',
              args: [
                BigInt(snapshot.amountRaw),
                BigInt(snapshot.durationSeconds),
                BigInt(snapshot.deadline),
                snapshot.v,
                snapshot.r,
                snapshot.s,
              ],
            } as never),
          waitForReceipt: async (hash) => {
            const broadcastPending = buildPendingStakeTransaction({
              account: wallet.address!,
              chainId: POLYGON_CHAIN_ID,
              hash,
              action,
            });
            rememberPending(broadcastPending);
            setTransactionHash(hash);
            setStatus('confirming');
            // Once broadcast, drop permit so CTA cannot imply a second write.
            setPermit(null);
            return waitForPolygonWalletReceipt(hash);
          },
          confirmOnServer: (hash) =>
            confirmStakingTransactionOnServer({
              transactionHash: hash,
              account: wallet.address!,
              action,
            }),
          isPermitStillValid: (freshAccount) =>
            freshAccount.address.toLowerCase() ===
              snapshot.owner.toLowerCase() &&
            isPermitSnapshotValid(snapshot, {
              owner: wallet.address,
              chainId: POLYGON_CHAIN_ID,
              amountRaw: amountRawString,
              durationSeconds: durationSeconds ?? -1,
              nowSeconds: Math.floor(Date.now() / 1000),
              currentNonce: freshAccount.permitNonce,
            }),
          isPermitExpired: () =>
            Math.floor(Date.now() / 1000) >= snapshot.deadline,
        });

        if (outcome.kind === 'fresh_account_failed') {
          setStatus('error');
          setError(getStakingErrorMessage('account_refetch_failed', locale));
          return;
        }

        if (outcome.kind === 'invalid_permit') {
          setPermit(null);
          setSuccess(null);
          setStatus('error');
          setError(
            getStakingErrorMessage(
              outcome.expired ? 'expired_permit' : 'invalid_permit',
              locale,
            ),
          );
          return;
        }

        if (outcome.kind === 'rejected_before_broadcast') {
          // Keep permit for Continue Stake.
          setStatus('error');
          setError(formatStakingError(outcome.error, locale));
          return;
        }

        if (outcome.kind === 'confirmation_unavailable') {
          const pendingTx = buildPendingStakeTransaction({
            account: wallet.address,
            chainId: POLYGON_CHAIN_ID,
            hash: outcome.hash,
            action,
          });
          logStakingFailure('stake: confirmation_unavailable', {
            hash: outcome.hash,
            receiptError: outcome.receiptError,
            verificationError: outcome.verificationError,
          });
          rememberPending(pendingTx);
          setTransactionHash(outcome.hash);
          setPermit(null);
          setStatus('confirmation_unavailable');
          setError(copy.confirmationUnavailable);
          return;
        }

        if (outcome.kind === 'reverted') {
          clearPendingRecord();
          setTransactionHash(null);
          setPermit(null);
          setStatus('error');
          setError(getStakingErrorMessage('reverted', locale));
          return;
        }

        applyConfirmed(outcome.hash, outcome.syncFailed);
      } catch (err) {
        setStatus('error');
        setError(formatStakingError(err, locale));
      }
    },
    [
      amountRawString,
      applyConfirmed,
      clearPendingRecord,
      config,
      copy.confirmationUnavailable,
      durationSeconds,
      ensurePolygonWalletClient,
      freshQuote,
      locale,
      refetchAccount,
      rememberPending,
      wallet.address,
      wallet.isConnected,
    ],
  );

  /** Orchestrate resume receipt / reuse permit / create+stake. */
  const permitAndStake = useCallback(async () => {
    if (!pendingLoaded) return;

    setError(null);
    setWarning(null);

    const hasValidPermitNow = isPermitSnapshotValid(permit, {
      owner: wallet.address,
      chainId: wallet.chainId,
      amountRaw: amountRawString,
      durationSeconds: durationSeconds ?? -1,
      nowSeconds: Math.floor(Date.now() / 1000),
      currentNonce: account?.permitNonce,
    });

    // Persisted or in-session pending broadcast — resume confirmation only.
    const pendingTx =
      pending != null && status !== 'success' ? pending : null;

    const action = resolvePermitAndStakeAction({
      hasPendingHash: pendingTx != null,
      hasValidPermit: hasValidPermitNow,
    });

    // Fresh attempt (not resuming): clear prior success UI / display hash.
    if (action !== 'resume_receipt') {
      setSuccess(null);
      if (status === 'success') {
        setTransactionHash(null);
      }
    }

    await runPermitThenStake({
      action,
      existingPermit: permit,
      createPermit: createPermitSnapshot,
      submit: submitStakeWithPermit,
      resumeReceipt: async () => {
        if (!pendingTx) return;
        await resumeConfirmReceipt(pendingTx);
      },
    });
  }, [
    account?.permitNonce,
    amountRawString,
    createPermitSnapshot,
    durationSeconds,
    pending,
    pendingLoaded,
    permit,
    resumeConfirmReceipt,
    status,
    submitStakeWithPermit,
    wallet.address,
    wallet.chainId,
  ]);

  const isBusy =
    !pendingLoaded ||
    status === 'signing' ||
    status === 'submitting' ||
    status === 'confirming';

  const hasValidPermit = isPermitSnapshotValid(permit, {
    owner: wallet.address,
    chainId: wallet.chainId,
    amountRaw: amountRawString,
    durationSeconds: durationSeconds ?? -1,
    nowSeconds,
    currentNonce: account?.permitNonce,
  });

  /** Broadcast happened; next click must wait on this hash, not write again. */
  const hasPendingHash = pending != null && status !== 'success';

  return {
    permit,
    status,
    error,
    warning,
    success,
    transactionHash,
    isBusy,
    hasValidPermit,
    hasPendingHash,
    permitAndStake,
    resetAfterSuccess,
    clearMessages,
  };
}
