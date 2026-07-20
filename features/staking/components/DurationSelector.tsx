import React from 'react';

import type { StakingDurationOption } from '../staking.types.ts';

type DurationSelectorProps = {
  options: StakingDurationOption[];
  selectedSeconds: number | null;
  onSelect: (seconds: number) => void;
  disabled?: boolean;
  labelId: string;
  daysLabel: (days: number) => string;
  aprLabel: (apr: number) => string;
};

/**
 * Discrete duration chips (replaces the old MUI slider).
 * Keyboard: Tab between options, Enter/Space to select.
 */
export default function DurationSelector({
  options,
  selectedSeconds,
  onSelect,
  disabled = false,
  labelId,
  daysLabel,
  aprLabel,
}: DurationSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
    >
      {options.map((option) => {
        const selected = option.seconds === selectedSeconds;
        return (
          <button
            key={option.seconds}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onSelect(option.seconds)}
            className={`
              rounded-2xl border px-3 py-3 text-left transition
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400
              disabled:cursor-not-allowed disabled:opacity-50
              ${
                selected
                  ? 'border-cyan-400/50 bg-cyan-400/10 text-white'
                  : 'border-white/10 bg-white/5 text-white/80 hover:border-white/25 hover:bg-white/10'
              }
            `}
          >
            <div className="text-sm font-semibold">{daysLabel(option.days)}</div>
            <div className="mt-1 text-xs text-cyan-300/90">{aprLabel(option.apr)}</div>
          </button>
        );
      })}
    </div>
  );
}
