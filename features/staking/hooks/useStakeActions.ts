import { useCallback, useEffect, useRef, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { polygon } from 'wagmi/chains';
import { POLYGON_CHAIN_ID } from '../../../constants/network.ts';
import {
  STAKING_CONTRACT_ABI,
  STAKING_CONTRACT_ADDRESS,
} from '../../../constants/stakingContracts.ts';
import { useInjectedWallet } from '../../web3/useInjectedWallet.ts';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage.ts';
import { getPolygonWalletClient } from '../../web3/getPolygonWalletClient.ts';
import { waitForPolygonWalletReceipt } from '../../web3/waitForPolygonWalletReceipt.ts';
import { getStakingCopy } from '../staking.copy.ts';
import { confirmStakingTransactionOnServer } from '../stakingApi.ts';
import { confirmStakeReceipt } from '../stakeTransactionFlow.ts';
import { usePendingStakeTransaction } from './usePendingStakeTransaction.ts';
import {
  buildPendingStakeTransaction,
  pendingStakeTransactionMatchesWallet,
} from '../stakePendingTransactionStorage.ts';
import {
  formatStakingError,
  getStakingErrorMessage,
  logStakingFailure,
} from '../stakingErrors.ts';

import type { Hex } from '../../../types/blockchain.types.ts';
import type {
  PendingStakeTransaction,
  StakeActionKind,
  StakeTransactionStatus,
  StakingTransactionActionSnapshot,
} from '../staking.types.ts';

const ACTION_PENDING_KINDS = ['claim', 'unstake', 'unstakeEarly'] as const;

type UseStakeActionsInput = {
  refetchAccount: () => Promise<unknown>;
  /** When true, refuse new actions (e.g. form stake tx in flight). */
  externallyBusy?: boolean;
  /** Contract paused — all writes revert with whenNotPaused. */
  paused?: boolean;
  /** Config not ready — do not allow writes that need grace/penalty rules. */
  configReady?: boolean;
};

function actionSnapshot(
  stakeId: number,
  kind: StakeActionKind,
): StakingTransactionActionSnapshot {
  return { kind, stakeId };
}

/**
 * Claim / unstake / early-unstake writes.
 * Each action waits for receipt before refetch; only one action at a time.
 */
export function useStakeActions({
  refetchAccount,
  externallyBusy = false,
  paused = false,
  configReady = true,
}: UseStakeActionsInput) {
  const { locale } = useSiteLanguage();
  const copy = getStakingCopy(locale);
  const wallet = useInjectedWallet();
  const publicClient = usePublicClient({ chainId: POLYGON_CHAIN_ID });

  const [status, setStatus] = useState<StakeTransactionStatus>('idle');
  const [action, setAction] = useState<{
    stakeId: number;
    kind: StakeActionKind;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<Hex | null>(null);
  const [syncRequired, setSyncRequired] = useState(false);

  const {
    pending,
    pendingLoaded,
    rememberPending,
    clearPendingRecord,
    discardLocalPending,
  } = usePendingStakeTransaction({
    account: wallet.address,
    chainId: wallet.chainId,
    kinds: ACTION_PENDING_KINDS,
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

  // Restore Polygonscan hash + action target after reload.
  useEffect(() => {
    if (!pendingLoaded || !pending) return;
    if (pending.action.kind === 'stake') return;
    setTransactionHash(pending.hash);
    setAction({
      stakeId: pending.action.stakeId,
      kind: pending.action.kind,
    });
  }, [pending, pendingLoaded]);

  /** A known hash is non-terminal until receipt success/revert is observed. */
  const hasPendingHash = pending != null && status !== 'success';

  const isBusy =
    externallyBusy ||
    !pendingLoaded ||
    status === 'submitting' ||
    status === 'confirming' ||
    hasPendingHash ||
    syncRequired;

  const applyConfirmed = useCallback(
    (
      hash: Hex,
      syncFailed: boolean,
      pendingAction: { stakeId: number; kind: StakeActionKind },
      pendingTx?: PendingStakeTransaction | null,
    ) => {
      clearPendingRecord(pendingTx ?? null);
      setTransactionHash(hash);
      setAction(null);
      setStatus('success');
      setError(null);
      setSuccess(copy.actionSuccess[pendingAction.kind]);
      setWarning(syncFailed ? copy.actionAccountSyncWarning : null);
      setSyncRequired(syncFailed);
    },
    [clearPendingRecord, copy.actionAccountSyncWarning, copy.actionSuccess],
  );

  /**
   * Wait for a broadcast action without ever calling writeContract again.
   * Resume always re-validates sender/target/calldata on the server.
   */
  const confirmActionReceipt = useCallback(
    async (
      pendingTx: PendingStakeTransaction,
      requireServerValidation: boolean,
    ) => {
      if (pendingTx.action.kind === 'stake') return;

      const pendingAction = {
        stakeId: pendingTx.action.stakeId,
        kind: pendingTx.action.kind,
      };

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
        requireServerValidation,
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

      if (outcome.kind === 'reverted') {
        logStakingFailure('action-resume: reverted', { hash: pendingTx.hash });
        clearPendingRecord(pendingTx);
        setTransactionHash(null);
        setAction(null);
        setStatus('error');
        setError(getStakingErrorMessage('reverted', locale));
        return;
      }

      if (outcome.kind === 'confirmation_unavailable') {
        logStakingFailure('action: confirmation_unavailable', {
          hash: pendingTx.hash,
          receiptError: outcome.receiptError,
          verificationError: outcome.verificationError,
        });
        rememberPending(pendingTx);
        setTransactionHash(pendingTx.hash);
        setAction(pendingAction);
        setStatus('confirmation_unavailable');
        setError(copy.confirmationUnavailable);
        return;
      }

      applyConfirmed(
        pendingTx.hash,
        outcome.syncFailed,
        pendingAction,
        pendingTx,
      );
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

  const runWrite = useCallback(
    async (stakeId: number, kind: StakeActionKind) => {
      if (
        externallyBusy ||
        !configReady ||
        paused ||
        !pendingLoaded ||
        status === 'submitting' ||
        status === 'confirming' ||
        hasPendingHash ||
        syncRequired
      ) {
        return;
      }

      setError(null);
      setWarning(null);
      setSuccess(null);
      setTransactionHash(null);
      setSyncRequired(false);

      if (!wallet.isConnected || !wallet.address) {
        setError(getStakingErrorMessage('not_connected', locale));
        setStatus('error');
        return;
      }

      if (!configReady) {
        setError(getStakingErrorMessage('generic', locale));
        setStatus('error');
        return;
      }

      if (paused) {
        setError(getStakingErrorMessage('paused', locale));
        setStatus('error');
        return;
      }

      if (!publicClient) {
        setError(getStakingErrorMessage('rpc_unavailable', locale));
        setStatus('error');
        return;
      }

      const functionName =
        kind === 'claim'
          ? 'claimInterest'
          : kind === 'unstake'
            ? 'unstake'
            : 'unstakeEarly';

      const snapshot = actionSnapshot(stakeId, kind);
      setAction({ stakeId, kind });
      setStatus('submitting');

      let hash: Hex;
      try {
        // Switch chain first, then resolve a fresh wallet client.
        if (!wallet.isPolygon) {
          await wallet.ensurePolygon();
        }
        const walletClient = await getPolygonWalletClient();
        if (!walletClient) {
          throw new Error('RPC unavailable');
        }

        hash = await walletClient.writeContract({
          chain: polygon,
          account: wallet.address,
          address: STAKING_CONTRACT_ADDRESS,
          abi: STAKING_CONTRACT_ABI,
          functionName,
          args: [stakeId],
        } as never);
      } catch (err) {
        // No hash exists: this is a pre-broadcast rejection/failure and retry
        // may safely call writeContract again.
        setAction(null);
        setTransactionHash(null);
        setStatus('error');
        setError(formatStakingError(err, locale));
        return;
      }

      const pendingTx = buildPendingStakeTransaction({
        account: wallet.address,
        chainId: POLYGON_CHAIN_ID,
        hash,
        action: snapshot,
      });
      rememberPending(pendingTx);
      setTransactionHash(hash);
      // Fresh in-session path: browser receipt may confirm without server.
      await confirmActionReceipt(pendingTx, false);
    },
    [
      confirmActionReceipt,
      configReady,
      externallyBusy,
      hasPendingHash,
      locale,
      paused,
      pendingLoaded,
      publicClient,
      rememberPending,
      status,
      syncRequired,
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
    // Resume / reload always re-validates on the server.
    await confirmActionReceipt(pending, true);
  }, [confirmActionReceipt, pending, status]);

  const claimInterest = useCallback(
    (stakeId: number) => runWrite(stakeId, 'claim'),
    [runWrite],
  );

  const unstake = useCallback(
    (stakeId: number) => runWrite(stakeId, 'unstake'),
    [runWrite],
  );

  const unstakeEarly = useCallback(
    (stakeId: number) => runWrite(stakeId, 'unstakeEarly'),
    [runWrite],
  );

  return {
    status,
    action,
    error,
    warning,
    success,
    transactionHash,
    hasPendingHash,
    syncRequired,
    isBusy,
    resumePendingReceipt,
    claimInterest,
    unstake,
    unstakeEarly,
  };
}
