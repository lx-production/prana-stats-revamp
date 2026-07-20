import React from 'react';
import { Loader2 } from 'lucide-react';
import {
  calculateEarlyUnstakeReturn,
  formatPranaAmount,
} from '../stakingMath.ts';

import type { StakingCopy } from '../staking.copy.ts';
import type { StakeRecord } from '../staking.types.ts';

type EarlyUnstakeDialogProps = {
  stake: StakeRecord;
  penaltyPercent: number;
  copy: StakingCopy;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirm early unstake with dynamic penalty + principal return preview.
 * Replaces window.confirm from the legacy staking-ui.
 */
export default function EarlyUnstakeDialog({
  stake,
  penaltyPercent,
  copy,
  busy,
  onConfirm,
  onCancel,
}: EarlyUnstakeDialogProps) {
  const amountRaw = BigInt(stake.amountRaw);
  const { penaltyRaw, returnRaw } = calculateEarlyUnstakeReturn(
    amountRaw,
    penaltyPercent,
  );

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={busy ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="early-unstake-title"
        className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0a0718] p-5 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="early-unstake-title"
          className="text-lg font-medium tracking-wide"
        >
          {copy.earlyDialogTitle}
        </h2>
        <p className="mt-2 text-sm text-white/70">
          {copy.earlyDialogBody(penaltyPercent)}
        </p>

        <dl className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-white/55">{copy.earlyDialogPenalty}</dt>
            <dd className="font-medium text-red-300">
              −{formatPranaAmount(penaltyRaw)} PRANA ({penaltyPercent}%)
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-white/55">{copy.earlyDialogReturn}</dt>
            <dd className="font-medium text-white">
              {formatPranaAmount(returnRaw)} PRANA
            </dd>
          </div>
        </dl>

        <p
          className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100"
          role="status"
        >
          {copy.earlyDialogInterestLost}
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            className="btn-hero w-full border border-red-400/40 bg-red-500/15 text-red-200 sm:w-auto"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {copy.processing}
              </span>
            ) : (
              copy.earlyDialogConfirm
            )}
          </button>
          <button
            type="button"
            className="btn-hero btn-glass w-full sm:w-auto"
            disabled={busy}
            onClick={onCancel}
          >
            {copy.earlyDialogCancel}
          </button>
        </div>
      </div>
    </div>
  );
}
