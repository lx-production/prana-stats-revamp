import React from 'react';
import { Loader2 } from 'lucide-react';
import StatusBanner from '../../../components/ui/StatusBanner.tsx';
import { formatPranaAmount, formatWbtcAmount, getBondActionState } from '../utils/bondingMath.ts';

import type { BondingCopy } from '../bonding.copy.ts';
import type { SiteLocale } from '../../../types/locale.types.ts';
import type { ActiveBondRecord, BondClaimActionTarget } from '../bonding.types.ts';

type BondCardProps = {
  bond: ActiveBondRecord;
  nowSeconds: number;
  locale: SiteLocale;
  copy: BondingCopy;
  /** False until config is loaded — hides write actions. */
  actionsEnabled: boolean;
  /** This bond's deployment is paused — show reason, disable claim. */
  deploymentPaused: boolean;
  actionsLocked: boolean;
  activeClaim: BondClaimActionTarget | null;
  onClaim: (target: BondClaimActionTarget) => void;
};

function formatBondDate(unixSeconds: number, locale: SiteLocale): string {
  const date = new Date(unixSeconds * 1000);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  // Keep 24h clock for consistency across locales.
  const time = date.toLocaleTimeString(
    locale === 'en' ? 'en-GB' : 'vi-VN',
    { hour: '2-digit', minute: '2-digit', hour12: false },
  );

  return `${day}/${month}/${year}, ${time}`;
}

/**
 * Active bond row with claim CTA.
 * Key identity is side+version+id — IDs can collide across deployments.
 */
export default function BondCard({
  bond,
  nowSeconds,
  locale,
  copy,
  actionsEnabled,
  deploymentPaused,
  actionsLocked,
  activeClaim,
  onClaim,
}: BondCardProps) {
  const isBuy = bond.side === 'buy';
  const principal = isBuy
    ? `${formatWbtcAmount(bond.wbtcAmountRaw)} WBTC`
    : `${formatPranaAmount(bond.pranaAmountRaw)} PRANA`;
  const payout = isBuy
    ? `${formatPranaAmount(bond.pranaAmountRaw)} PRANA`
    : `${formatWbtcAmount(bond.wbtcAmountRaw)} WBTC`;
  const claimed = isBuy
    ? `${formatPranaAmount(bond.claimedRaw)} PRANA`
    : `${formatWbtcAmount(bond.claimedRaw)} WBTC`;

  const actionState = getBondActionState(bond, nowSeconds);
  const claimable = isBuy
    ? `${formatPranaAmount(actionState.claimableRaw)} PRANA`
    : `${formatWbtcAmount(actionState.claimableRaw)} WBTC`;
  const progress = actionState.progressPercent;

  const startTimeLabel = formatBondDate(bond.creationTime, locale);
  const maturityLabel = formatBondDate(bond.maturityTime, locale);

  const claimTarget: BondClaimActionTarget = {
    side: bond.side,
    version: bond.version,
    bondId: bond.id,
  };

  const isThisBusy =
    activeClaim != null &&
    activeClaim.side === bond.side &&
    activeClaim.version === bond.version &&
    activeClaim.bondId === bond.id;

  const canShowClaim =
    actionsEnabled && actionState.canClaim && !deploymentPaused;
  const buttonsDisabled =
    !actionsEnabled ||
    deploymentPaused ||
    actionsLocked ||
    Boolean(activeClaim);

  return (
    <article className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">
          {copy.bondId(bond.id)}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
              bond.side === 'sell'
                ? 'border-red-300/40 bg-red-400/10 text-red-200'
                : 'border-emerald-300/40 bg-emerald-400/10 text-emerald-200'
            }`}
          >
            {copy.sideBadge[bond.side]}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
              bond.version === 'v1'
                ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-200'
                : 'border-amber-300/50 bg-amber-400/15 text-amber-100'
            }`}
          >
            {copy.versionBadge[bond.version]}
          </span>
        </div>
      </div>

      <dl className="space-y-1.5 text-xs">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-white/45">{copy.principalLabel}</dt>
          <dd className="break-all text-right text-white/85">{principal}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-white/45">{copy.payoutLabel}</dt>
          <dd className="break-all text-right text-white/85">{payout}</dd>
        </div>        
        <div className="flex items-start justify-between gap-3">
          <dt className="text-white/45">{copy.claimedLabel}</dt>
          <dd className="break-all text-right text-white/85">{claimed}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-white/45">{copy.claimableLabel}</dt>
          <dd className="break-all text-right text-white/85">{claimable}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-white/45">{copy.startTimeLabel}</dt>
          <dd className="break-all text-right text-white/85">{startTimeLabel}</dd>
        </div>
      </dl>

      <div className="!mt-6 space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-xs text-white/55">
          <span>
            {copy.maturityLabel}: {maturityLabel}
          </span>
          <span>{copy.progressComplete(progress)}</span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-amber-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {actionsEnabled && deploymentPaused && actionState.canClaim ? (
        <StatusBanner tone="warning" className="text-xs">
          {copy.claimPausedReason}
        </StatusBanner>
      ) : null}

      {canShowClaim ? (
        <div className="pt-1">
          <button
            type="button"
            className="btn-stake btn-gold-border w-full"
            disabled={buttonsDisabled}
            onClick={() => onClaim(claimTarget)}
          >
            {isThisBusy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {copy.claimingCta}
              </span>
            ) : (
              copy.claimBond[bond.side]
            )}
          </button>
        </div>
      ) : null}
    </article>
  );
}
