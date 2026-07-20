import { useCallback, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { polygon } from 'wagmi/chains';
import { POLYGON_CHAIN_ID } from '../../../constants/network.ts';
import {
  STAKING_CONTRACT_ABI,
  STAKING_CONTRACT_ADDRESS,
} from '../../../constants/stakingContracts.ts';
import { useInjectedWallet } from '../../../hooks/useInjectedWallet.ts';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage.ts';
import { getPolygonWalletClient } from '../getPolygonWalletClient.ts';
import { getStakingCopy } from '../staking.copy.ts';
import { confirmStakeReceipt } from '../stakeTransactionFlow.ts';
import {
  formatStakingError,
  getStakingErrorMessage,
} from '../stakingErrors.ts';

import type { Hex } from '../../../types/blockchain.types.ts';
import type { StakeActionKind, StakeTransactionStatus } from '../staking.types.ts';

type UseStakeActionsInput = {
  refetchAccount: () => Promise<unknown>;
  /** When true, refuse new actions (e.g. form stake tx in flight). */
  externallyBusy?: boolean;
  /** Contract paused — all writes revert with whenNotPaused. */
  paused?: boolean;
  /** Config not ready — do not allow writes that need grace/penalty rules. */
  configReady?: boolean;
};

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

  /** A known hash is non-terminal until receipt success/revert is observed. */
  const hasPendingHash =
    transactionHash != null && status !== 'success';

  const isBusy =
    externallyBusy ||
    status === 'submitting' ||
    status === 'confirming' ||
    hasPendingHash ||
    syncRequired;

  /**
   * Wait for a broadcast action without ever calling writeContract again.
   * Account refresh failure after a successful receipt is a warning, not a
   * transaction failure, so stale action buttons remain locked behind reload.
   */
  const confirmActionReceipt = useCallback(
    async (
      hash: Hex,
      pendingAction: { stakeId: number; kind: StakeActionKind },
    ) => {
      if (!publicClient) {
        setStatus('error');
        setError(getStakingErrorMessage('rpc_unavailable', locale));
        return;
      }

      setStatus('confirming');
      setError(null);
      setWarning(null);

      const outcome = await confirmStakeReceipt(hash, {
        waitForReceipt: (txHash) =>
          publicClient.waitForTransactionReceipt({ hash: txHash }),
        refetchAccount,
      });

      if (outcome.kind === 'reverted') {
        setTransactionHash(null);
        setAction(null);
        setStatus('error');
        setError(getStakingErrorMessage('reverted', locale));
        return;
      }

      if (outcome.kind === 'receipt_pending') {
        // Keep hash + action so the dedicated resume button only waits again.
        setTransactionHash(hash);
        setAction(pendingAction);
        setStatus('error');
        setError(formatStakingError(outcome.error, locale));
        return;
      }

      setTransactionHash(hash);
      setAction(null);
      setStatus('success');
      setError(null);
      setSuccess(copy.actionSuccess[pendingAction.kind]);
      setWarning(outcome.syncFailed ? copy.actionAccountSyncWarning : null);
      setSyncRequired(outcome.syncFailed);
    },
    [
      copy.actionAccountSyncWarning,
      copy.actionSuccess,
      locale,
      publicClient,
      refetchAccount,
    ],
  );

  const runWrite = useCallback(
    async (stakeId: number, kind: StakeActionKind) => {
      if (
        externallyBusy ||
        !configReady ||
        paused ||
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

      setTransactionHash(hash);
      await confirmActionReceipt(hash, { stakeId, kind });
    },
    [
      confirmActionReceipt,
      configReady,
      externallyBusy,
      hasPendingHash,
      locale,
      paused,
      publicClient,
      status,
      syncRequired,
      wallet,
    ],
  );

  const resumePendingReceipt = useCallback(async () => {
    if (
      !transactionHash ||
      !action ||
      status === 'success' ||
      status === 'submitting' ||
      status === 'confirming'
    ) return;
    await confirmActionReceipt(transactionHash, action);
  }, [action, confirmActionReceipt, status, transactionHash]);

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
