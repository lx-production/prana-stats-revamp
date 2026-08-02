import { polygon } from 'wagmi/chains';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getBondingCopy } from '../bonding.copy.ts';
import { POLYGON_CHAIN_ID } from '../../../constants/network.ts';
import { useInjectedWallet } from '../../web3/useInjectedWallet.ts';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage.ts';
import { usePendingBondTransaction } from './usePendingBondTransaction.ts';
import { getPolygonWalletClient } from '../../web3/getPolygonWalletClient.ts';
import { confirmBondingTransactionOnServer } from '../utils/bondingApi.ts';
import { waitForPolygonWalletReceipt } from '../../web3/waitForPolygonWalletReceipt.ts';
import { confirmBondReceipt, submitBondWriteFlow } from '../utils/bondTransactionFlow.ts';
import { bondClaimKey, isBondDeploymentPaused, resolveBondClaimTarget } from '../utils/bondClaimTarget.ts';

import {
  formatBondingError,
  getBondingErrorMessage,
  logBondingFailure,
} from '../utils/bondingErrors.ts';
import {
  buildPendingBondTransaction,
  pendingBondTransactionMatchesWallet,
} from '../utils/bondPendingTransactionStorage.ts';

import type { Address, Hex } from '../../../types/blockchain.types.ts';
import type {
  BondClaimActionTarget,
  BondingConfig,
  BondingTransactionActionSnapshot,
  BondTransactionStatus,
  PendingBondTransaction,
} from '../bonding.types.ts';

const CLAIM_PENDING_KINDS = ['claim'] as const;

type UseBondActionsInput = {
  config: BondingConfig | undefined;
  refetchAccount: () => Promise<unknown>;
  /** When true, refuse new claims (e.g. form approve/create in flight). */
  externallyBusy?: boolean;
  /** Config not ready — do not allow writes. */
  configReady?: boolean;
};

/**
 * Claim writes for active bonds (Buy/Sell × V1/V2).
 * Target comes from internal side/version mapping; never from API address.
 * One claim at a time; pending hash only resumes confirmation (no second write).
 */
export function useBondActions({
  config,
  refetchAccount,
  externallyBusy = false,
  configReady = true,
}: UseBondActionsInput) {
  const { locale } = useSiteLanguage();
  const copy = getBondingCopy(locale);
  const wallet = useInjectedWallet();

  const [status, setStatus] = useState<BondTransactionStatus>('idle');
  const [action, setAction] = useState<BondClaimActionTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
    kinds: CLAIM_PENDING_KINDS,
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

  // Restore Polygonscan hash + claim target after reload.
  useEffect(() => {
    if (!pendingLoaded || !pending || pending.action.kind !== 'claim') return;
    setTransactionHash(pending.hash);
    setAction({
      side: pending.action.side,
      version: pending.action.version,
      bondId: pending.action.bondId,
    });
  }, [pending, pendingLoaded]);

  const hasPendingHash = pending != null && status !== 'success';

  // Own work only — externallyBusy locks writes but must not echo into parent.
  const isBusy =
    !pendingLoaded ||
    status === 'submitting' ||
    status === 'confirming' ||
    hasPendingHash;

  const applyConfirmed = useCallback(
    (hash: Hex, syncFailed: boolean, pendingTx?: PendingBondTransaction | null) => {
      clearPendingRecord(pendingTx ?? null);
      setTransactionHash(hash);
      setAction(null);
      setStatus('success');
      setError(null);
      setSuccess(copy.claimConfirmed);
      setWarning(syncFailed ? copy.accountSyncWarning : null);
    },
    [clearPendingRecord, copy.accountSyncWarning, copy.claimConfirmed],
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
        logBondingFailure('claim-resume: reverted', { hash: pendingTx.hash });
        clearPendingRecord(pendingTx);
        setTransactionHash(null);
        setAction(null);
        setStatus('error');
        setError(getBondingErrorMessage('reverted', locale));
        return;
      }

      // Keep hash + snapshot; never treat as failed write.
      logBondingFailure('claim-resume: confirmation_unavailable', {
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

  const claimBond = useCallback(
    async (target: BondClaimActionTarget) => {
      if (
        externallyBusy ||
        !configReady ||
        !pendingLoaded ||
        status === 'submitting' ||
        status === 'confirming' ||
        hasPendingHash
      ) {
        return;
      }

      setError(null);
      setWarning(null);
      setSuccess(null);
      setTransactionHash(null);

      if (!wallet.isConnected || !wallet.address) {
        logBondingFailure('claim: not_connected');
        setError(getBondingErrorMessage('not_connected', locale));
        setStatus('error');
        return;
      }

      if (!config || !configReady) {
        logBondingFailure('claim: missing config');
        setError(getBondingErrorMessage('generic', locale));
        setStatus('error');
        return;
      }

      if (
        isBondDeploymentPaused(config.paused, target.side, target.version)
      ) {
        logBondingFailure('claim: paused', target);
        setError(getBondingErrorMessage('paused', locale));
        setStatus('error');
        return;
      }

      // Capture identity before wallet prompts — may change mid-flight.
      const submittingAccount = wallet.address as Address;

      // Internal mapping only — ignore any contract address from API/UI.
      const claimTarget = resolveBondClaimTarget(target.side, target.version);
      const bondId = BigInt(target.bondId);

      const actionSnapshot: BondingTransactionActionSnapshot = {
        kind: 'claim',
        side: target.side,
        version: target.version,
        bondId: target.bondId,
      };

      setAction(target);
      setStatus('submitting');

      try {
        if (!wallet.isPolygon) {
          await wallet.ensurePolygon();
        }
        const walletClient = await getPolygonWalletClient();
        if (!walletClient) {
          throw new Error('RPC unavailable');
        }

        let broadcastPending: PendingBondTransaction | null = null;

        // No explicit simulateContract — same pattern as staking claim/unstake.
        const outcome = await submitBondWriteFlow({
          refetchAccount,
          validateFreshAccount: () => true,
          write: async () =>
            walletClient.writeContract({
              chain: polygon,
              account: submittingAccount,
              address: claimTarget.address,
              abi: claimTarget.abi,
              functionName: 'claimBond',
              args: [bondId],
            } as never),
          waitForReceipt: async (hash) => {
            broadcastPending = buildPendingBondTransaction({
              account: submittingAccount,
              chainId: POLYGON_CHAIN_ID,
              hash,
              action: actionSnapshot,
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
              action: actionSnapshot,
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
          setAction(null);
          setStatus('idle');
          return;
        }

        if (outcome.kind === 'fresh_account_failed') {
          logBondingFailure('claim: fresh_account_failed');
          setAction(null);
          setStatus('error');
          setError(getBondingErrorMessage('account_refetch_failed', locale));
          return;
        }
        if (outcome.kind === 'validation_failed') {
          logBondingFailure('claim: validation_failed');
          setAction(null);
          setStatus('error');
          setError(getBondingErrorMessage('generic', locale));
          return;
        }
        if (outcome.kind === 'rejected_before_broadcast') {
          setAction(null);
          clearPendingRecord(broadcastPending);
          setStatus('error');
          setError(formatBondingError(outcome.error, locale));
          return;
        }
        if (outcome.kind === 'confirmation_unavailable') {
          logBondingFailure('claim: confirmation_unavailable', {
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
              action: actionSnapshot,
            });
          rememberPending(pendingTx);
          setTransactionHash(outcome.hash);
          setStatus('confirmation_unavailable');
          setError(copy.confirmationUnavailable);
          return;
        }
        if (outcome.kind === 'reverted') {
          logBondingFailure('claim: reverted', {
            hash: outcome.hash,
            source: outcome.source,
          });
          clearPendingRecord(broadcastPending);
          setTransactionHash(null);
          setAction(null);
          setStatus('error');
          setError(getBondingErrorMessage('reverted', locale));
          return;
        }

        applyConfirmed(outcome.hash, outcome.syncFailed, broadcastPending);
      } catch (err) {
        setAction(null);
        clearPendingRecord();
        setStatus('error');
        setError(formatBondingError(err, locale));
      }
    },
    [
      applyConfirmed,
      clearPendingRecord,
      config,
      configReady,
      copy.confirmationUnavailable,
      discardLocalPending,
      externallyBusy,
      hasPendingHash,
      locale,
      pendingLoaded,
      refetchAccount,
      rememberPending,
      status,
      wallet,
    ],
  );

  const resumePendingReceipt = useCallback(async () => {
    if (
      !pending ||
      status === 'success' ||
      status === 'submitting' ||
      status === 'confirming'
    ) {
      return;
    }
    await resumeConfirmReceipt(pending);
  }, [pending, resumeConfirmReceipt, status]);

  const isClaiming = useCallback(
    (target: BondClaimActionTarget) => {
      if (!action) return false;
      return (
        bondClaimKey(action.side, action.version, action.bondId) ===
        bondClaimKey(target.side, target.version, target.bondId)
      );
    },
    [action],
  );

  return {
    status,
    action,
    error,
    warning,
    success,
    transactionHash,
    hasPendingHash,
    pendingLoaded,
    isBusy,
    claimBond,
    resumePendingReceipt,
    isClaiming,
  };
}
