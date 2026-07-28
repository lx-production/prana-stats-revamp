import React, { useRef } from 'react';

import type { BondSide } from '../bonding.types.ts';

type BondSideTabsProps = {
  side: BondSide;
  onSelect: (side: BondSide) => void;
  disabled?: boolean;
  buyLabel: string;
  sellLabel: string;
  /** Accessible name for the tablist (no visible label needed). */
  ariaLabel: string;
};

const SIDES: BondSide[] = ['buy', 'sell'];

/**
 * Buy / Sell underline tabs with roving tabindex + arrow keys.
 */
export default function BondSideTabs({
  side,
  onSelect,
  disabled = false,
  buyLabel,
  sellLabel,
  ariaLabel,
}: BondSideTabsProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = SIDES.indexOf(side);
  const tabStopIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const labelFor = (value: BondSide) =>
    value === 'buy' ? buyLabel : sellLabel;

  const focusAndSelect = (index: number) => {
    const next = SIDES[index];
    if (!next) return;
    onSelect(next);
    buttonRefs.current[index]?.focus();
  };

  const onTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (disabled) return;

    let nextIndex: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % SIDES.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + SIDES.length) % SIDES.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = SIDES.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    focusAndSelect(nextIndex);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex border-b border-white/10"
    >
      {SIDES.map((value, index) => {
        const selected = value === side;
        return (
          <button
            key={value}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={disabled ? -1 : index === tabStopIndex ? 0 : -1}
            disabled={disabled}
            onClick={() => onSelect(value)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
            className={`
              relative -mb-px flex-1 px-3 py-2.5 text-sm font-semibold transition-colors duration-200
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5D27A]
              disabled:cursor-not-allowed disabled:opacity-50
              ${
                selected
                  ? 'border-b-2 border-[#F5D27A] text-white'
                  : 'border-b-2 border-transparent text-white/50 hover:text-white/80'
              }
            `}
          >
            {labelFor(value)}
          </button>
        );
      })}
    </div>
  );
}
