import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage.ts';
import { getStakingCopy } from '../staking.copy.ts';
import { useStakeActions } from '../hooks/useStakeActions.ts';
import EarlyUnstakeDialog from './EarlyUnstakeDialog.tsx';
import StakeCard from './StakeCard.tsx';
import TxLink from './TxLink.tsx';

import type { StakeRecord, StakingConfig } from '../staking.types.ts';

type ActiveStakesProps = {
  stakes: StakeRecord[] | undefined;
  loading: boolean;
  error: boolean;
  /** Chain block timestamp from the account snapshot when available. */
  blockTimestamp?: number;
  config: StakingConfig | undefined;
  configLoading: boolean;
  configError: boolean;
  refetchAccount: () => Promise<unknown>;
  /** Lock stake actions while the stake form tx is running. */
  actionsLocked?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

/**
 * Lists the connected wallet's stakes and wires claim / unstake actions.
 * Wall time = blockTimestamp + elapsed (less dependent on local clock skew).
 * Write actions stay off until config is loaded and not paused.
 */
export default function ActiveStakes({
  stakes,
  loading,
  error,
  blockTimestamp,
  config,
  configLoading,
  configError,
  refetchAccount,
  actionsLocked = false,
  onBusyChange,
}: ActiveStakesProps) {
  const { locale } = useSiteLanguage();
  const copy = getStakingCopy(locale);

  const configReady = Boolean(config) && !configLoading && !configError;
  const paused = Boolean(config?.paused);
  const actionsEnabled = configReady && !paused;

  const stakeActions = useStakeActions({
    refetchAccount,
    externallyBusy: actionsLocked,
    paused,
    configReady,
  });

  useEffect(() => {
    onBusyChange?.(stakeActions.isBusy);
  }, [onBusyChange, stakeActions.isBusy]);

  // Close early-unstake dialog after a confirmed receipt.
  useEffect(() => {
    if (stakeActions.status === 'success') {
      setEarlyStake(null);
    }
  }, [stakeActions.status]);

  const [earlyStake, setEarlyStake] = useState<StakeRecord | null>(null);

  // Prefer chain time when we have it; tick locally so progress updates.
  const [nowSeconds, setNowSeconds] = useState(() =>
    blockTimestamp ?? Math.floor(Date.now() / 1000),
  );

  useEffect(() => {
    if (blockTimestamp != null) {
      setNowSeconds(blockTimestamp);
    }
  }, [blockTimestamp]);

  useEffect(() => {
    const baseWallClock = Date.now();
    const baseChainSeconds = blockTimestamp ?? Math.floor(Date.now() / 1000);

    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - baseWallClock) / 1000);
      setNowSeconds(baseChainSeconds + elapsed);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [blockTimestamp]);

  const openEarlyDialog = (stakeId: number) => {
    if (!actionsEnabled || !config) return;
    const stake = stakes?.find((item) => item.id === stakeId) ?? null;
    setEarlyStake(stake);
  };

  const gracePeriodSeconds = config?.gracePeriodSeconds ?? 0;
  const penaltyPercent = config?.earlyUnstakePenaltyPercent ?? 0;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
      <h2 className="text-lg font-medium tracking-wide text-white">
        {copy.activeStakesHeading}
      </h2>

      {configLoading ? (
        <p className="mt-3 text-sm text-white/55" role="status">
          {copy.stakesConfigPending}
        </p>
      ) : null}
      {configError ? (
        <p className="mt-3 text-sm text-amber-200" role="status">
          {copy.stakesConfigError}
        </p>
      ) : null}
      {configReady && paused ? (
        <p
          className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100"
          role="status"
        >
          {copy.stakesPausedBanner}
        </p>
      ) : null}

      {stakeActions.error ? (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {stakeActions.error}
        </p>
      ) : null}
      {stakeActions.success ? (
        <p className="mt-3 text-sm text-emerald-300" role="status">
          {stakeActions.success}
          {stakeActions.transactionHash ? (
            <>
              {' '}
              <TxLink
                hash={stakeActions.transactionHash}
                label={copy.viewOnPolygonscan}
              />
            </>
          ) : null}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {copy.loadingStakes}
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-red-300" role="alert">
          {copy.accountError}
        </p>
      ) : !stakes || stakes.length === 0 ? (
        <p className="mt-4 text-sm text-white/55">{copy.noStakes}</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {stakes.map((stake) => (
            <StakeCard
              key={stake.id}
              stake={stake}
              nowSeconds={nowSeconds}
              gracePeriodSeconds={gracePeriodSeconds}
              penaltyPercent={penaltyPercent}
              locale={locale}
              copy={copy}
              actionsEnabled={actionsEnabled}
              actionsLocked={actionsLocked || stakeActions.isBusy}
              activeAction={stakeActions.action}
              onClaim={(id) => void stakeActions.claimInterest(id)}
              onUnstake={(id) => void stakeActions.unstake(id)}
              onUnstakeEarly={openEarlyDialog}
            />
          ))}
        </div>
      )}

      {earlyStake && actionsEnabled && config ? (
        <EarlyUnstakeDialog
          stake={earlyStake}
          penaltyPercent={config.earlyUnstakePenaltyPercent}
          copy={copy}
          busy={stakeActions.isBusy}
          onCancel={() => {
            if (!stakeActions.isBusy) setEarlyStake(null);
          }}
          onConfirm={() => {
            void stakeActions.unstakeEarly(earlyStake.id);
          }}
        />
      ) : null}
    </section>
  );
}
