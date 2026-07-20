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
import { accountFromRefetch } from '../accountRefetch.ts';
import { getPolygonWalletClient } from '../getPolygonWalletClient.ts';
import { isPermitSnapshotValid } from '../permitUtils.ts';
import {
  formatStakingError,
  getStakingErrorMessage,
} from '../stakingErrors.ts';

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
 * Sign EIP-2612 permit + submit stakeWithPermit.
 * Success only after waitForTransactionReceipt confirms.
 */
export function useStakeTransaction({
  config,
  account,
  amountRaw,
  durationSeconds,
  refetchAccount,
}: UseStakeTransactionInput) {
  const { locale } = useSiteLanguage();
  const wallet = useInjectedWallet();
  const publicClient = usePublicClient({ chainId: POLYGON_CHAIN_ID });

  const [permit, setPermit] = useState<PermitSnapshot | null>(null);
  const [status, setStatus] = useState<StakeTransactionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
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
      setSuccess(null);
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

  const signPermit = useCallback(async () => {
    clearMessages();
    setTransactionHash(null);

    if (!wallet.isConnected || !wallet.address) {
      setError(getStakingErrorMessage('not_connected', locale));
      setStatus('error');
      return;
    }

    if (!config) {
      setError(getStakingErrorMessage('generic', locale));
      setStatus('error');
      return;
    }

    if (config.paused) {
      setError(getStakingErrorMessage('paused', locale));
      setStatus('error');
      return;
    }

    if (amountRaw == null || amountRaw <= 0n || durationSeconds == null) {
      setError(getStakingErrorMessage('invalid_amount', locale));
      setStatus('error');
      return;
    }

    const minStakeRaw = BigInt(config.minStakeRaw);
    if (amountRaw < minStakeRaw) {
      setError(getStakingErrorMessage('below_min', locale));
      setStatus('error');
      return;
    }

    setStatus('signing');

    try {
      const walletClient = await ensurePolygonWalletClient();

      // Fresh nonce + balance right before signing.
      const snapshot = accountFromRefetch(await refetchAccount(), account);

      if (!snapshot) {
        setError(getStakingErrorMessage('generic', locale));
        setStatus('error');
        return;
      }

      if (amountRaw > BigInt(snapshot.balanceRaw)) {
        setError(getStakingErrorMessage('insufficient_balance', locale));
        setStatus('error');
        return;
      }

      const deadline = Math.floor(Date.now() / 1000) + PERMIT_DEADLINE_SECONDS;
      const nonce = BigInt(snapshot.permitNonce);

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

      setPermit({
        owner: wallet.address,
        chainId: POLYGON_CHAIN_ID,
        nonce: nonce.toString(),
        amountRaw: amountRaw.toString(),
        durationSeconds,
        deadline,
        v: Number(parsed.v),
        r: parsed.r,
        s: parsed.s,
      });
      setStatus('signed');
      setSuccess(
        locale === 'en'
          ? 'Permit signed. You can stake now.'
          : 'Permit đã ký. Bạn có thể stake ngay.',
      );
    } catch (err) {
      setPermit(null);
      setStatus('error');
      setError(formatStakingError(err, locale));
    }
  }, [
    account,
    amountRaw,
    clearMessages,
    config,
    durationSeconds,
    ensurePolygonWalletClient,
    locale,
    refetchAccount,
    wallet.address,
    wallet.isConnected,
  ]);

  const submitStake = useCallback(async () => {
    clearMessages();

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

    if (!permit) {
      setError(getStakingErrorMessage('invalid_permit', locale));
      setStatus('error');
      return;
    }

    setStatus('submitting');

    try {
      const walletClient = await ensurePolygonWalletClient();

      // Revalidate nonce (and form fields) against a fresh account snapshot.
      const snapshot = accountFromRefetch(await refetchAccount(), account);
      const now = Math.floor(Date.now() / 1000);

      if (
        !snapshot ||
        !isPermitSnapshotValid(permit, {
          owner: wallet.address,
          chainId: POLYGON_CHAIN_ID,
          amountRaw: amountRawString,
          durationSeconds: durationSeconds ?? -1,
          nowSeconds: now,
          currentNonce: snapshot.permitNonce,
        })
      ) {
        setPermit(null);
        setSuccess(null);
        setError(
          snapshot && now >= permit.deadline
            ? getStakingErrorMessage('expired_permit', locale)
            : getStakingErrorMessage('invalid_permit', locale),
        );
        setStatus('error');
        return;
      }

      const hash = await walletClient.writeContract({
        chain: polygon,
        account: wallet.address,
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_CONTRACT_ABI,
        functionName: 'stakeWithPermit',
        args: [
          BigInt(permit.amountRaw),
          BigInt(permit.durationSeconds),
          BigInt(permit.deadline),
          permit.v,
          permit.r,
          permit.s,
        ],
      } as never);

      setTransactionHash(hash);
      setStatus('confirming');

      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      if (receipt.status === 'reverted') {
        throw new Error('Transaction reverted');
      }

      setStatus('success');
      setSuccess(
        locale === 'en'
          ? 'Stake confirmed on Polygon.'
          : 'Stake đã được xác nhận trên Polygon.',
      );
      setPermit(null);
      await refetchAccount();
    } catch (err) {
      setStatus('error');
      setError(formatStakingError(err, locale));
    }
  }, [
    account,
    amountRawString,
    clearMessages,
    config,
    durationSeconds,
    ensurePolygonWalletClient,
    locale,
    permit,
    publicClient,
    refetchAccount,
    wallet.address,
    wallet.isConnected,
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

  return {
    permit,
    status,
    error,
    success,
    transactionHash,
    isBusy,
    hasValidPermit,
    signPermit,
    submitStake,
    resetAfterSuccess,
    clearMessages,
  };
}
