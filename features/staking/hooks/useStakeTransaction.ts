import { useCallback, useEffect, useState } from 'react';
import { parseSignature } from 'viem';
import { usePublicClient } from 'wagmi';
import { polygon } from 'wagmi/chains';
import { POLYGON_CHAIN_ID } from '../../../constants/network.ts';
import {
  PERMIT_DEADLINE_SECONDS,
  PRANA_PERMIT_TYPES,
  STAKING_CONTRACT_ABI,
  STAKING_CONTRACT_ADDRESS,
} from '../../../constants/stakingContracts.ts';
import { useInjectedWallet } from '../../../hooks/useInjectedWallet.ts';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage.ts';
import { getStakingCopy } from '../staking.copy.ts';
import { accountFromSuccessfulRefetch } from '../accountRefetch.ts';
import { getPolygonWalletClient } from '../getPolygonWalletClient.ts';
import { isPermitSnapshotValid } from '../permitUtils.ts';
import {
  formatStakingError,
  getStakingErrorMessage,
} from '../stakingErrors.ts';
import {
  confirmStakeReceipt,
  runPermitThenStake,
  resolvePermitAndStakeAction,
  submitStakeWithPermitFlow,
} from '../stakeTransactionFlow.ts';

import type { Hex } from '../../../types/blockchain.types.ts';
import type {
  PermitSnapshot,
  StakeTransactionStatus,
  StakingAccountSnapshot,
  StakingConfig,
} from '../staking.types.ts';

type UseStakeTransactionInput = {
  config: StakingConfig | undefined;
  account: StakingAccountSnapshot | undefined;
  amountRaw: bigint | null;
  durationSeconds: number | null;
  /** Refetch account before signing/submit (fresh nonce) and after success. */
  refetchAccount: () => Promise<unknown>;
};

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
    setTransactionHash(null);
  }, []);

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
    (hash: Hex, syncFailed: boolean) => {
      setTransactionHash(hash);
      setPermit(null);
      setStatus('success');
      setError(null);
      setSuccess(copy.stakeConfirmed);
      setWarning(syncFailed ? copy.accountSyncWarning : null);
    },
    [copy.accountSyncWarning, copy.stakeConfirmed],
  );

  /**
   * Resume waitForTransactionReceipt for an already-broadcast hash.
   * Never calls writeContract again.
   */
  const resumeConfirmReceipt = useCallback(
    async (hash: Hex) => {
      setStatus('confirming');
      setError(null);
      setWarning(null);

      const outcome = await confirmStakeReceipt(hash, {
        waitForReceipt: (txHash) =>
          publicClient!.waitForTransactionReceipt({ hash: txHash }),
        refetchAccount,
      });

      if (outcome.kind === 'confirmed') {
        applyConfirmed(hash, outcome.syncFailed);
        return;
      }

      if (outcome.kind === 'reverted') {
        setTransactionHash(null);
        setPermit(null);
        setStatus('error');
        setError(getStakingErrorMessage('reverted', locale));
        return;
      }

      // Keep hash so the next click resumes receipt wait only.
      setTransactionHash(hash);
      setPermit(null);
      setStatus('error');
      setError(formatStakingError(outcome.error, locale));
    },
    [applyConfirmed, locale, publicClient, refetchAccount],
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

      const minStakeRaw = BigInt(config.minStakeRaw);
      if (amountRaw < minStakeRaw) {
        setError(getStakingErrorMessage('below_min', locale));
        setStatus('error');
        return null;
      }

      setStatus('signing');

      try {
        const walletClient = await ensurePolygonWalletClient();

        // Must be a successful refetch — never fall back to cached nonce/balance.
        const accountSnapshot = accountFromSuccessfulRefetch(
          await refetchAccount(),
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

      setStatus('submitting');

      try {
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
            setTransactionHash(hash);
            setStatus('confirming');
            // Once broadcast, drop permit so CTA cannot imply a second write.
            setPermit(null);
            return publicClient!.waitForTransactionReceipt({ hash });
          },
          isPermitStillValid: (freshAccount) =>
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

        if (outcome.kind === 'broadcast_receipt_pending') {
          setTransactionHash(outcome.hash);
          setPermit(null);
          setStatus('error');
          setError(formatStakingError(outcome.error, locale));
          return;
        }

        if (outcome.kind === 'reverted') {
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
      config,
      durationSeconds,
      ensurePolygonWalletClient,
      locale,
      publicClient,
      refetchAccount,
      wallet.address,
      wallet.isConnected,
    ],
  );

  /** Orchestrate resume receipt / reuse permit / create+stake. */
  const permitAndStake = useCallback(async () => {
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

    // Success keeps hash for Polygonscan — that is NOT a pending broadcast.
    const pendingHash =
      transactionHash != null && status !== 'success' ? transactionHash : null;

    const action = resolvePermitAndStakeAction({
      hasPendingHash: pendingHash != null,
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
        if (!pendingHash) return;
        await resumeConfirmReceipt(pendingHash);
      },
    });
  }, [
    account?.permitNonce,
    amountRawString,
    createPermitSnapshot,
    durationSeconds,
    permit,
    resumeConfirmReceipt,
    status,
    submitStakeWithPermit,
    transactionHash,
    wallet.address,
    wallet.chainId,
  ]);

  const isBusy =
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
  const hasPendingHash =
    transactionHash != null && status !== 'success';

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
