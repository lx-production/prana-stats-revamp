import React from 'react';

import type { StatusBannerProps, StatusBannerTone } from '../../types/statusBanner.types';

const TONE_CLASS: Record<StatusBannerTone, string> = {
  neutral: 'border-white/15 bg-white/5 text-white/70',
  success: 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100',
  warning: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  error: 'border-red-400/25 bg-red-500/10 text-red-100',
};

/**
 * Shared alert / status banner (staking + reusable elsewhere).
 * Uses role=alert for errors and role=status otherwise, with aria-live.
 */
export default function StatusBanner({
  children,
  tone = 'neutral',
  className = '',
  live,
}: StatusBannerProps) {
  const isError = tone === 'error';
  const resolvedLive = live ?? (isError ? 'assertive' : 'polite');

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={resolvedLive === 'off' ? undefined : resolvedLive}
      className={`rounded-xl border px-3 py-2 text-sm ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
