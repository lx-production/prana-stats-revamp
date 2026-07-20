import React from 'react';
import {
  calculateAccruedInterestRaw,
  calculateTotalInterestRaw,
  daysFromSeconds,
  formatPranaAmount,
  getEffectiveAccruedSeconds,
  getStakeDisplayStatus,
  getStakeEndTime,
  getStakeProgressPercent,
} from '../stakingMath.ts';

import type { SiteLocale } from '../../../types/locale.types.ts';
import type { StakeRecord } from '../staking.types.ts';

type StakeCardCopy = {
  stakeId: (id: number) => string;
  statusActive: string;
  statusMatured: string;
  aprLabel: (apr: number) => string;
  durationDays: (days: number) => string;
  started: string;
  ends: string;
  progressComplete: (percent: number) => string;
  accruedInterest: string;
  maturityInterest: string;
  actionsComingSoon: string;
};

type StakeCardProps = {
  stake: StakeRecord;
  nowSeconds: number;
  locale: SiteLocale;
  copy: StakeCardCopy;
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

/**
 * Read-only stake summary for Bước 4.
 * Claim / unstake / early-unstake actions arrive in Bước 5.
 */
export default function StakeCard({
  stake,
  nowSeconds,
  locale,
  copy,
}: StakeCardProps) {
  const status = getStakeDisplayStatus(stake, nowSeconds);
  const progress = getStakeProgressPercent(stake, nowSeconds);
  const endTime = getStakeEndTime(stake);
  const amountRaw = BigInt(stake.amountRaw);

  const accruedRaw = calculateAccruedInterestRaw(
    amountRaw,
    stake.apr,
    getEffectiveAccruedSeconds(stake, nowSeconds),
  );
  const maturityRaw = calculateTotalInterestRaw(
    amountRaw,
    stake.apr,
    stake.durationSeconds,
  );

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition hover:border-white/20">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">
          {copy.stakeId(stake.id)}
        </h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            status === 'matured'
              ? 'bg-emerald-400/15 text-emerald-300'
              : 'bg-cyan-400/15 text-cyan-300'
          }`}
        >
          {status === 'matured' ? copy.statusMatured : copy.statusActive}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-3">
        <div className="text-xl font-semibold text-white">
          {formatPranaAmount(amountRaw)}{' '}
          <span className="text-sm font-normal text-white/55">PRANA</span>
        </div>
        <span className="rounded-md border border-white/10 px-2 py-0.5 text-xs text-cyan-300">
          {copy.aprLabel(stake.apr)}
        </span>
      </div>

      <p className="mt-2 text-sm text-white/60">
        {copy.durationDays(daysFromSeconds(stake.durationSeconds))}
      </p>

      <div className="mt-3 grid gap-1 text-xs text-white/55 sm:grid-cols-2">
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

      <p className="mt-4 text-xs text-white/40">{copy.actionsComingSoon}</p>
    </article>
  );
}
