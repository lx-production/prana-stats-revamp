import React, { useEffect, useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { Loader2 } from 'lucide-react';
import { PRANA_DECIMALS } from '../../../constants/sharedContracts.ts';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage.ts';
import { getStakingCopy } from '../staking.copy.ts';
import {
  calculateTotalInterestRaw,
  formatPranaAmount,
  getDefaultDurationSeconds,
  isStakeAmountInput,
  parseStakeAmount,
} from '../stakingMath.ts';
import DurationSelector from './DurationSelector.tsx';

import type { StakingAccountSnapshot, StakingConfig } from '../staking.types.ts';

type StakingFormProps = {
  config: StakingConfig | undefined;
  account: StakingAccountSnapshot | undefined;
  configLoading: boolean;
  configError: boolean;
};

/**
 * Stake amount + duration form.
 * Balance and MAX live in the amount header (no separate PranaBalance card).
 * Permit / stake submission is wired in Bước 5 — buttons stay disabled here.
 */
export default function StakingForm({
  config,
  account,
  configLoading,
  configError,
}: StakingFormProps) {
  const { locale } = useSiteLanguage();
  const copy = getStakingCopy(locale);

  const [amount, setAmount] = useState('');
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);

  // Default to 30 days when present, else the first config option.
  useEffect(() => {
    if (durationSeconds != null || !config?.durations.length) return;
    setDurationSeconds(getDefaultDurationSeconds(config.durations));
  }, [config, durationSeconds]);

  const balanceRaw = account ? BigInt(account.balanceRaw) : 0n;
  const balanceFormatted = account
    ? formatUnits(balanceRaw, PRANA_DECIMALS)
    : '—';

  const minStakeRaw = config ? BigInt(config.minStakeRaw) : 0n;
  const minStakeFormatted = config
    ? formatPranaAmount(config.minStakeRaw)
    : '—';

  const selectedDuration = useMemo(
    () => config?.durations.find((option) => option.seconds === durationSeconds) ?? null,
    [config, durationSeconds],
  );

  const parsedAmount = parseStakeAmount(amount);

  const projectedInterest = useMemo(() => {
    if (!parsedAmount.ok || !selectedDuration) return '0';
    const raw = calculateTotalInterestRaw(
      parsedAmount.raw,
      selectedDuration.apr,
      selectedDuration.seconds,
    );
    return formatPranaAmount(raw);
  }, [parsedAmount, selectedDuration]);

  const amountError = useMemo(() => {
    if (!amount) return null;
    if (parsedAmount.ok === false) {
      return copy.amountReasons[parsedAmount.reason];
    }
    if (config && parsedAmount.raw < minStakeRaw) {
      return copy.minStakeHint(minStakeFormatted);
    }
    if (account && parsedAmount.raw > balanceRaw) {
      return copy.exceedsBalance;
    }
    return null;
  }, [
    amount,
    parsedAmount,
    config,
    minStakeRaw,
    minStakeFormatted,
    account,
    balanceRaw,
    copy,
  ]);

  const paused = Boolean(config?.paused);
  const formDisabled = paused || configLoading || !config;

  const setMaxAmount = () => {
    if (!account || balanceRaw <= 0n) {
      setAmount('');
      return;
    }
    setAmount(formatUnits(balanceRaw, PRANA_DECIMALS));
  };

  if (configLoading) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {copy.loadingConfig}
        </div>
      </section>
    );
  }

  if (configError || !config) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
        <p className="text-sm text-red-300" role="alert">
          {copy.configError}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
      <h2 className="text-lg font-medium tracking-wide text-white">
        {copy.stakeHeading}
      </h2>

      {paused ? (
        <p
          className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100"
          role="status"
        >
          {copy.pausedBanner}
        </p>
      ) : null}

      <div className="mt-5 space-y-5">
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="stake-amount"
              className="text-sm font-medium text-white/70"
            >
              {copy.amountLabel}
            </label>
            <div className="flex items-center gap-2 text-xs text-white/55">
              <span>
                {copy.balanceLabel}:{' '}
                <span className="text-white/85">{balanceFormatted}</span> PRANA
              </span>
              <button
                type="button"
                className="rounded-md border border-white/15 px-2 py-0.5 font-semibold text-cyan-300 transition hover:border-cyan-400/40 hover:text-cyan-200 disabled:opacity-40"
                onClick={setMaxAmount}
                disabled={formDisabled || !account || balanceRaw <= 0n}
              >
                {copy.maxButton}
              </button>
            </div>
          </div>

          <input
            id="stake-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            disabled={formDisabled}
            placeholder={copy.minStakeHint(minStakeFormatted)}
            onChange={(event) => {
              const value = event.target.value;
              if (isStakeAmountInput(value)) setAmount(value);
            }}
            className="w-full rounded-2xl border border-white/15 bg-transparent px-4 py-3 text-white placeholder:text-white/30 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/40 disabled:opacity-50"
          />

          {amountError ? (
            <p className="mt-2 text-xs text-red-300" role="alert">
              {amountError}
            </p>
          ) : null}
        </div>

        <div>
          <div
            id="duration-label"
            className="mb-2 text-sm font-medium text-white/70"
          >
            {copy.durationLabel}
          </div>
          <DurationSelector
            options={config.durations}
            selectedSeconds={durationSeconds}
            onSelect={setDurationSeconds}
            disabled={formDisabled}
            labelId="duration-label"
            daysLabel={copy.durationDays}
            aprLabel={copy.aprLabel}
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-white/45">
            {copy.projectedInterestLabel}
          </div>
          <div className="mt-1 text-xl font-semibold text-white">
            ≈ {projectedInterest}{' '}
            <span className="text-sm font-normal text-white/55">PRANA</span>
          </div>
          <p className="mt-1 text-xs text-white/45">{copy.projectedInterestHint}</p>
        </div>

        <p className="text-xs text-white/45" role="status">
          {copy.txComingSoon}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="btn-hero btn-glass w-full sm:w-auto"
            disabled
            title={copy.txComingSoon}
          >
            {copy.signPermit}
          </button>
          <button
            type="button"
            className="btn-hero btn-gold-border w-full sm:w-auto"
            disabled
            title={copy.txComingSoon}
          >
            {copy.stakeAction}
          </button>
        </div>
      </div>
    </section>
  );
}
