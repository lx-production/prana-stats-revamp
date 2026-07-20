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
  const wallet = useInjectedWallet();
  const publicClient = usePublicClient({ chainId: POLYGON_CHAIN_ID });

  const [status, setStatus] = useState<StakeTransactionStatus>('idle');
  const [action, setAction] = useState<{
    stakeId: number;
    kind: StakeActionKind;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<Hex | null>(null);

  const isBusy =
    externallyBusy ||
    status === 'submitting' ||
    status === 'confirming';

  const runWrite = useCallback(
    async (stakeId: number, kind: StakeActionKind) => {
      if (
        externallyBusy ||
        !configReady ||
        paused ||
        status === 'submitting' ||
        status === 'confirming'
      ) {
        return;
      }

      setError(null);
      setSuccess(null);
      setTransactionHash(null);

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

      try {
        // Switch chain first, then resolve a fresh wallet client.
        if (!wallet.isPolygon) {
          await wallet.ensurePolygon();
        }
        const walletClient = await getPolygonWalletClient();
        if (!walletClient) {
          throw new Error('RPC unavailable');
        }

        const hash = await walletClient.writeContract({
          chain: polygon,
          account: wallet.address,
          address: STAKING_CONTRACT_ADDRESS,
          abi: STAKING_CONTRACT_ABI,
          functionName,
          args: [stakeId],
        } as never);

        setTransactionHash(hash);
        setStatus('confirming');

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === 'reverted') {
          throw new Error('Transaction reverted');
        }

        setStatus('success');
        setSuccess(
          locale === 'en'
            ? kind === 'claim'
              ? 'Interest claim confirmed.'
              : kind === 'unstake'
                ? 'Unstake confirmed.'
                : 'Early unstake confirmed.'
            : kind === 'claim'
              ? 'Claim lãi đã được xác nhận.'
              : kind === 'unstake'
                ? 'Unstake đã được xác nhận.'
                : 'Unstake sớm đã được xác nhận.',
        );
        await refetchAccount();
      } catch (err) {
        setStatus('error');
        setError(formatStakingError(err, locale));
      } finally {
        setAction(null);
      }
    },
    [
      configReady,
      externallyBusy,
      locale,
      paused,
      publicClient,
      refetchAccount,
      status,
      wallet,
    ],
  );

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
    success,
    transactionHash,
    isBusy,
    claimInterest,
    unstake,
    unstakeEarly,
  };
}
