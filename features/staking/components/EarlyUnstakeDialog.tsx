import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import StatusBanner from '../../../components/ui/StatusBanner.tsx';
import { trapFocus } from '../../../utils/focusTrap.ts';
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
 * Focus is trapped while open; Escape cancels (when not busy).
 */
export default function EarlyUnstakeDialog({
  stake,
  penaltyPercent,
  copy,
  busy,
  onConfirm,
  onCancel,
}: EarlyUnstakeDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const busyRef = useRef(busy);

  onCancelRef.current = onCancel;
  busyRef.current = busy;

  const amountRaw = BigInt(stake.amountRaw);
  const { penaltyRaw, returnRaw } = calculateEarlyUnstakeReturn(
    amountRaw,
    penaltyPercent,
  );

  // Trap Tab, handle Escape, restore focus to the trigger on unmount.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;

    return trapFocus(node, {
      initialFocus: cancelRef.current,
      onEscape: () => {
        if (!busyRef.current) onCancelRef.current();
      },
    });
  }, []);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={busy ? undefined : onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="early-unstake-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0a0718] p-5 text-white shadow-2xl outline-none"
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

        <StatusBanner tone="warning" className="mt-3 text-xs">
          {copy.earlyDialogInterestLost}
        </StatusBanner>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            className="btn-stake btn-danger w-full sm:w-auto"
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
            ref={cancelRef}
            type="button"
            className="btn-hero btn-glass w-full sm:w-auto text-sm"
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
