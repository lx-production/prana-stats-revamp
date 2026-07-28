import React from 'react';
import {
  formatPranaAmount,
  formatWbtcAmount,
  getBondClaimableRaw,
  getBondProgressPercent,
} from '../bondingMath.ts';

import type { SiteLocale } from '../../../types/locale.types.ts';
import type { ActiveBondRecord } from '../bonding.types.ts';
import type { BondingCopy } from '../bonding.copy.ts';

type BondCardProps = {
  bond: ActiveBondRecord;
  nowSeconds: number;
  locale: SiteLocale;
  copy: BondingCopy;
};

function formatBondDate(unixSeconds: number, locale: SiteLocale): string {
  return new Date(unixSeconds * 1000).toLocaleString(
    locale === 'en' ? 'en-GB' : 'vi-VN',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  );
}

/**
 * Read-only active bond row (claim actions land in Bước 6).
 * Key identity is side+version+id — IDs can collide across deployments.
 */
export default function BondCard({
  bond,
  nowSeconds,
  locale,
  copy,
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

  const totalPayoutRaw = BigInt(
    isBuy ? bond.pranaAmountRaw : bond.wbtcAmountRaw,
  );
  const claimableRaw = getBondClaimableRaw(
    totalPayoutRaw,
    BigInt(bond.claimedRaw),
    bond.creationTime,
    bond.maturityTime,
    nowSeconds,
  );
  const claimable = isBuy
    ? `${formatPranaAmount(claimableRaw)} PRANA`
    : `${formatWbtcAmount(claimableRaw)} WBTC`;

  const progress = getBondProgressPercent(
    bond.creationTime,
    bond.maturityTime,
    nowSeconds,
  );

  const maturityLabel = formatBondDate(bond.maturityTime, locale);

  return (
    <article className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">
          {copy.bondId(bond.id)}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/70">
            {copy.sideBadge[bond.side]}
          </span>
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/70">
            {copy.versionBadge[bond.version]}
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-white/45">{copy.principalLabel}</dt>
          <dd className="mt-0.5 break-all text-white/85">{principal}</dd>
        </div>
        <div>
          <dt className="text-white/45">{copy.payoutLabel}</dt>
          <dd className="mt-0.5 break-all text-white/85">{payout}</dd>
        </div>
        <div>
          <dt className="text-white/45">{copy.claimedLabel}</dt>
          <dd className="mt-0.5 break-all text-white/85">{claimed}</dd>
        </div>
        <div>
          <dt className="text-white/45">{copy.claimableLabel}</dt>
          <dd className="mt-0.5 break-all text-white/85">{claimable}</dd>
        </div>
      </dl>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-xs text-white/55">
          <span>
            {copy.maturityLabel}: {maturityLabel}
          </span>
          <span>{copy.progressComplete(progress)}</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-[#F5D27A]/80"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </article>
  );
}
