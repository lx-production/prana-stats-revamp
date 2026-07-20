import React, { useRef } from 'react';

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
 * Radiogroup pattern: one tab stop + arrow keys / Home / End.
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
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedIndex = options.findIndex(
    (option) => option.seconds === selectedSeconds,
  );
  // Roving tabindex lands on the selected option, else the first.
  const tabStopIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const focusAndSelect = (index: number) => {
    const next = options[index];
    if (!next) return;
    onSelect(next.seconds);
    buttonRefs.current[index]?.focus();
  };

  const onRadioKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (disabled || options.length === 0) return;

    let nextIndex: number | null = null;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % options.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + options.length) % options.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = options.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    focusAndSelect(nextIndex);
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className="grid grid-cols-3 gap-2"
    >
      {options.map((option, index) => {
        const selected = option.seconds === selectedSeconds;
        return (
          <button
            key={option.seconds}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={disabled ? -1 : index === tabStopIndex ? 0 : -1}
            disabled={disabled}
            onClick={() => onSelect(option.seconds)}
            onKeyDown={(event) => onRadioKeyDown(event, index)}
            className={`
              rounded-2xl border px-3 py-3 text-center transition-all duration-300
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5D27A]
              disabled:cursor-not-allowed disabled:opacity-50
              ${
                selected
                  ? 'border-[#F5D27A]/45 bg-[#F5D27A]/10 text-white'
                  : 'border-white/10 bg-white/5 text-white/80 hover:border-white/25 hover:bg-white/10'
              }
            `}
          >
            <div className="text-sm font-semibold">{daysLabel(option.days)}</div>
            <div className="mt-1 text-xs text-cyan-300/90">
              {aprLabel(option.apr)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
