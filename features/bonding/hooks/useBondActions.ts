import { useCallback, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { polygon } from 'wagmi/chains';
import { POLYGON_CHAIN_ID } from '../../../constants/network.ts';
import { useInjectedWallet } from '../../web3/useInjectedWallet.ts';
import { getPolygonWalletClient } from '../../web3/getPolygonWalletClient.ts';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage.ts';
import { confirmBondingTransactionOnServer } from '../bondingApi.ts';
import { getBondingCopy } from '../bonding.copy.ts';
import {
  formatBondingError,
  getBondingErrorMessage,
} from '../bondingErrors.ts';
import {
  confirmBondReceipt,
  submitBondWriteFlow,
} from '../bondTransactionFlow.ts';
import {
  bondClaimKey,
  isBondDeploymentPaused,
  resolveBondClaimTarget,
} from '../utils/bondClaimTarget.ts';

import type { Address, Hex } from '../../../types/blockchain.types.ts';
import type {
  BondClaimActionTarget,
  BondingConfig,
  BondingTransactionActionSnapshot,
  BondTransactionStatus,
} from '../bonding.types.ts';
import type { PendingBondTransaction } from '../bondTransactionFlow.ts';

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
  const publicClient = usePublicClient({ chainId: POLYGON_CHAIN_ID });

  const [status, setStatus] = useState<BondTransactionStatus>('idle');
  const [action, setAction] = useState<BondClaimActionTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingBondTransaction | null>(null);
  const [transactionHash, setTransactionHash] = useState<Hex | null>(null);

  const hasPendingHash = pending != null && status !== 'success';

  const isBusy =
    externallyBusy ||
    status === 'submitting' ||
    status === 'confirming' ||
    hasPendingHash;

  const applyConfirmed = useCallback(
    (hash: Hex, syncFailed: boolean) => {
      setPending(null);
      setTransactionHash(hash);
      setAction(null);
      setStatus('success');
      setError(null);
      setSuccess(copy.claimConfirmed);
      setWarning(syncFailed ? copy.accountSyncWarning : null);
    },
    [copy.accountSyncWarning, copy.claimConfirmed],
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
        setAction(null);
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

  const claimBond = useCallback(
    async (target: BondClaimActionTarget) => {
      if (
        externallyBusy ||
        !configReady ||
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
        setError(getBondingErrorMessage('not_connected', locale));
        setStatus('error');
        return;
      }

      if (!config || !configReady) {
        setError(getBondingErrorMessage('generic', locale));
        setStatus('error');
        return;
      }

      if (
        isBondDeploymentPaused(config.paused, target.side, target.version)
      ) {
        setError(getBondingErrorMessage('paused', locale));
        setStatus('error');
        return;
      }

      if (!publicClient) {
        setError(getBondingErrorMessage('rpc_unavailable', locale));
        setStatus('error');
        return;
      }

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

        const outcome = await submitBondWriteFlow({
          refetchAccount,
          validateFreshAccount: () => true,
          simulate: async () => {
            const request = await publicClient.simulateContract({
              account: wallet.address!,
              address: claimTarget.address,
              abi: claimTarget.abi,
              functionName: 'claimBond',
              args: [bondId],
              chain: polygon,
            } as never);
            return {
              address: claimTarget.address,
              functionName: 'claimBond',
              args: [bondId] as const,
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
              abi: claimTarget.abi,
              functionName: 'claimBond',
              args: simulated.args,
            } as never);
          },
          waitForReceipt: async (hash) => {
            setPending({ hash, action: actionSnapshot });
            setTransactionHash(hash);
            setStatus('confirming');
            return publicClient.waitForTransactionReceipt({ hash });
          },
          confirmOnServer: (hash) =>
            confirmBondingTransactionOnServer({
              transactionHash: hash,
              account: wallet.address!,
              action: actionSnapshot,
            }),
        });

        if (outcome.kind === 'fresh_account_failed') {
          setAction(null);
          setStatus('error');
          setError(getBondingErrorMessage('account_refetch_failed', locale));
          return;
        }
        if (outcome.kind === 'validation_failed') {
          setAction(null);
          setStatus('error');
          setError(getBondingErrorMessage('generic', locale));
          return;
        }
        if (outcome.kind === 'simulate_failed') {
          setAction(null);
          setPending(null);
          setStatus('error');
          setError(getBondingErrorMessage('simulate_failed', locale));
          return;
        }
        if (outcome.kind === 'rejected_before_broadcast') {
          setAction(null);
          setPending(null);
          setStatus('error');
          setError(formatBondingError(outcome.error, locale));
          return;
        }
        if (outcome.kind === 'confirmation_unavailable') {
          setPending({ hash: outcome.hash, action: actionSnapshot });
          setTransactionHash(outcome.hash);
          setStatus('confirmation_unavailable');
          setError(copy.confirmationUnavailable);
          return;
        }
        if (outcome.kind === 'reverted') {
          setPending(null);
          setTransactionHash(null);
          setAction(null);
          setStatus('error');
          setError(getBondingErrorMessage('reverted', locale));
          return;
        }

        applyConfirmed(outcome.hash, outcome.syncFailed);
      } catch (err) {
        setAction(null);
        setPending(null);
        setStatus('error');
        setError(formatBondingError(err, locale));
      }
    },
    [
      applyConfirmed,
      config,
      configReady,
      copy.confirmationUnavailable,
      externallyBusy,
      hasPendingHash,
      locale,
      publicClient,
      refetchAccount,
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
    isBusy,
    claimBond,
    resumePendingReceipt,
    isClaiming,
  };
}
