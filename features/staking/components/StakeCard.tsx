import React from 'react';
import { Loader2 } from 'lucide-react';
import StatusBanner from '../../../components/ui/StatusBanner.tsx';
import {
  calculateAccruedInterestRaw,
  calculateTotalInterestRaw,
  daysFromSeconds,
  formatPranaAmount,
  getEffectiveAccruedSeconds,
  getStakeActionState,
  getStakeDisplayStatus,
  getStakeEndTime,
  getStakeProgressPercent,
} from '../stakingMath.ts';

import type { SiteLocale } from '../../../types/locale.types.ts';
import type { StakingCopy } from '../staking.copy.ts';
import type { StakeActionKind, StakeRecord } from '../staking.types.ts';

type StakeCardProps = {
  stake: StakeRecord;
  nowSeconds: number;
  gracePeriodSeconds: number;
  penaltyPercent: number;
  locale: SiteLocale;
  copy: StakingCopy;
  /** False until config is loaded and not paused — hides write actions. */
  actionsEnabled: boolean;
  actionsLocked: boolean;
  activeAction: { stakeId: number; kind: StakeActionKind } | null;
  onClaim: (stakeId: number) => void;
  onUnstake: (stakeId: number) => void;
  onUnstakeEarly: (stakeId: number) => void;
};

function formatStakeDate(unixSeconds: number, locale: SiteLocale): string {
  return new Date(unixSeconds * 1000).toLocaleString(
    locale === 'en' ? 'en-GB' : 'vi-VN',
    {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    },
  );
}

function statusPillClass(status: string): string {
  switch (status) {
    case 'claim_first':
      return 'bg-amber-400/15 text-amber-200';
    case 'grace_expired':
      return 'bg-red-400/15 text-red-300';
    case 'matured':
      return 'bg-emerald-400/15 text-emerald-300';
    default:
      return 'bg-cyan-400/15 text-cyan-300';
  }
}

/**
 * Stake summary + claim / unstake / early-unstake actions.
 */
export default function StakeCard({
  stake,
  nowSeconds,
  gracePeriodSeconds,
  penaltyPercent,
  locale,
  copy,
  actionsEnabled,
  actionsLocked,
  activeAction,
  onClaim,
  onUnstake,
  onUnstakeEarly,
}: StakeCardProps) {
  // Without a real config grace period, only show active/matured — never invent rules.
  const actionState = actionsEnabled
    ? getStakeActionState(stake, nowSeconds, gracePeriodSeconds)
    : null;
  const status = actionState?.status ?? getStakeDisplayStatus(stake, nowSeconds);
  const accruedRaw =
    actionState?.accruedRaw ??
    calculateAccruedInterestRaw(
      BigInt(stake.amountRaw),
      stake.apr,
      getEffectiveAccruedSeconds(stake, nowSeconds),
    );
  const canClaim = Boolean(actionsEnabled && actionState?.canClaim);
  const canUnstake = Boolean(actionsEnabled && actionState?.canUnstake);
  const canUnstakeEarly = Boolean(actionsEnabled && actionState?.canUnstakeEarly);
  const mustClaimBeforeUnstake = Boolean(
    actionsEnabled && actionState?.mustClaimBeforeUnstake,
  );
  const warnUnclaimedExpired = Boolean(
    actionsEnabled && actionState?.warnUnclaimedExpired,
  );

  const progress = getStakeProgressPercent(stake, nowSeconds);
  const endTime = getStakeEndTime(stake);
  const amountRaw = BigInt(stake.amountRaw);
  const maturityRaw = calculateTotalInterestRaw(
    amountRaw,
    stake.apr,
    stake.durationSeconds,
  );

  const isThisBusy =
    activeAction?.stakeId === stake.id &&
    (activeAction.kind === 'claim' ||
      activeAction.kind === 'unstake' ||
      activeAction.kind === 'unstakeEarly');
  const buttonsDisabled =
    !actionsEnabled || actionsLocked || Boolean(activeAction);

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition-all duration-500 hover:border-white/20 hover:bg-white/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">
          {copy.stakeId(stake.id)}
        </h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusPillClass(status)}`}
        >
          {copy.statusLabel[status]}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-3">
        <div className="text-xl font-semibold text-white">
          {formatPranaAmount(amountRaw)}{' '}
          <span className="text-sm font-normal text-white/55">PRANA</span>
        </div>
        <span className="w-fit rounded-md border border-white/10 px-2 py-0.5 text-xs text-cyan-300">
          {copy.aprLabel(stake.apr)}
        </span>
      </div>

      <p className="mt-2 text-sm text-white/60">
        {copy.durationDays(daysFromSeconds(stake.durationSeconds))}
      </p>

      {/* Stack metadata on mobile; two columns from sm up */}
      <div className="mt-3 flex flex-col gap-1 text-xs text-white/55 sm:grid sm:grid-cols-2">
        <div>
          {copy.started}: {formatStakeDate(stake.startTime, locale)}
        </div>
        <div>
          {copy.ends}: {formatStakeDate(endTime, locale)}
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-amber-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 space-y-1 text-xs text-white/60">
          <div>{copy.progressComplete(progress)}</div>
          <div>
            {copy.accruedInterest}:{' '}
            <strong className="text-white/85">
              ≈ {formatPranaAmount(accruedRaw)}
            </strong>{' '}
            PRANA
          </div>
          <div>
            {copy.maturityInterest}:{' '}
            <strong className="text-white/85">
              ≈ {formatPranaAmount(maturityRaw)}
            </strong>{' '}
            PRANA
          </div>
        </div>
      </div>

      {mustClaimBeforeUnstake ? (
        <StatusBanner tone="warning" className="mt-3 text-xs">
          {copy.claimFirstHint}
        </StatusBanner>
      ) : null}

      {warnUnclaimedExpired ? (
        <StatusBanner tone="error" className="mt-3 text-xs">
          {copy.graceExpiredWarning}
        </StatusBanner>
      ) : null}

      {actionsEnabled ? (
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canClaim ? (
          <button
            type="button"
            className="btn-hero btn-glass w-full sm:w-auto"
            disabled={buttonsDisabled}
            onClick={() => onClaim(stake.id)}
          >
            {isThisBusy && activeAction?.kind === 'claim' ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {copy.processing}
              </span>
            ) : (
              copy.claimInterest
            )}
          </button>
        ) : null}

        {canUnstake ? (
          <button
            type="button"
            className="btn-hero btn-glass w-full sm:w-auto"
            disabled={buttonsDisabled}
            onClick={() => onUnstake(stake.id)}
          >
            {isThisBusy && activeAction?.kind === 'unstake' ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {copy.processing}
              </span>
            ) : (
              copy.unstake
            )}
          </button>
        ) : null}

        {canUnstakeEarly ? (
          <button
            type="button"
            className="btn-hero w-full border border-red-400/40 bg-red-500/10 text-red-200 sm:w-auto"
            disabled={buttonsDisabled}
            onClick={() => onUnstakeEarly(stake.id)}
          >
            {isThisBusy && activeAction?.kind === 'unstakeEarly' ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {copy.processing}
              </span>
            ) : (
              copy.unstakeEarly(penaltyPercent)
            )}
          </button>
        ) : null}
      </div>
      ) : null}
    </article>
  );
}
