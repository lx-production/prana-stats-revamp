import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import StatusBanner from '../../../components/ui/StatusBanner.tsx';
import { trapFocus } from '../../../utils/focusTrap.ts';
import {
  daysFromSeconds,
  formatPranaAmount,
  formatRateBpsPercent,
  formatWbtcAmount,
} from '../bondingMath.ts';

import type { BondingCopy } from '../bonding.copy.ts';
import type { BondingQuote } from '../bonding.types.ts';

type CreateBondReviewDialogProps = {
  quote: BondingQuote;
  copy: BondingCopy;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * In-app review before create-bond write. Does not open the wallet —
 * only the Confirm button starts the create transaction.
 */
export default function CreateBondReviewDialog({
  quote,
  copy,
  busy,
  error,
  onConfirm,
  onCancel,
}: CreateBondReviewDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const busyRef = useRef(busy);

  onCancelRef.current = onCancel;
  busyRef.current = busy;

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
        aria-labelledby="create-bond-review-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0a0718] p-5 text-white shadow-2xl outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="create-bond-review-title"
          className="text-lg font-medium tracking-wide"
        >
          {copy.reviewDialogTitle}
        </h2>
        <p className="mt-2 text-sm text-white/70">{copy.reviewDialogBody}</p>

        <dl className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-white/55">{copy.amountLabelWbtc}</dt>
            <dd className="font-medium text-white">
              {formatWbtcAmount(quote.wbtcAmountRaw)} WBTC
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-white/55">{copy.amountLabelPrana}</dt>
            <dd className="font-medium text-white">
              {formatPranaAmount(quote.pranaAmountRaw)} PRANA
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-white/55">{copy.rateLabel}</dt>
            <dd className="font-medium text-white">
              {formatRateBpsPercent(quote.rateBpsRaw)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-white/55">{copy.termLabel}</dt>
            <dd className="font-medium text-white">
              {copy.durationLabel(daysFromSeconds(quote.durationSeconds))}
            </dd>
          </div>
        </dl>

        {error ? (
          <StatusBanner tone="error" className="mt-3">
            {error}
          </StatusBanner>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            className="btn-hero btn-gold-border w-full sm:w-auto"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {copy.creatingBondCta}
              </span>
            ) : (
              copy.reviewDialogConfirm
            )}
          </button>
          <button
            ref={cancelRef}
            type="button"
            className="btn-hero btn-glass w-full sm:w-auto text-sm"
            disabled={busy}
            onClick={onCancel}
          >
            {copy.reviewDialogCancel}
          </button>
        </div>
      </div>
    </div>
  );
}
