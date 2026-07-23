import React, { useEffect, useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { Coins, Loader2 } from 'lucide-react';
import TxLink from './TxLink.tsx';
import { getStakingCopy } from '../staking.copy.ts';
import { getStakeCtaPhase } from '../stakeCtaPhase.ts';
import GlassPanel from '../../../components/ui/GlassPanel.tsx';
import StatusBanner from '../../../components/ui/StatusBanner.tsx';
import DurationSelector from './DurationSelector.tsx';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage.ts';
import { useInjectedWallet } from '../../web3/useInjectedWallet.ts';
import { PRANA_DECIMALS } from '../../../constants/sharedContracts.ts';
import { useStakeTransaction } from '../hooks/useStakeTransaction.ts';
import {
  parseStakeAmount,
  formatPranaAmount,
  isStakeAmountInput,
  calculateTotalInterestRaw,
  getDefaultDurationSeconds,
  getConfiguredDuration,
} from '../stakingMath.ts';

import type { StakingConfig, StakingAccountSnapshot } from '../staking.types.ts';

type StakingFormProps = {
  config: StakingConfig | undefined;
  account: StakingAccountSnapshot | undefined;
  configLoading: boolean;
  configError: boolean;
  refetchAccount: () => Promise<unknown>;
  /** Lock form while claim/unstake is running. */
  actionsLocked?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

/**
 * Stake amount + duration form with a single Permit & Stake CTA.
 */
export default function StakingForm({
  config,
  account,
  configLoading,
  configError,
  refetchAccount,
  actionsLocked = false,
  onBusyChange,
}: StakingFormProps) {
  const { locale } = useSiteLanguage();
  const copy = getStakingCopy(locale);
  const wallet = useInjectedWallet();

  const [amount, setAmount] = useState('');
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);

  // Default to 30 days when present. If refreshed config removes the selected
  // duration, move to a valid option instead of submitting a guaranteed revert.
  useEffect(() => {
    if (!config) return;
    const configuredDuration = getConfiguredDuration(
      config.durations,
      durationSeconds,
    );
    if (configuredDuration) return;
    setDurationSeconds(getDefaultDurationSeconds(config.durations));
  }, [config, durationSeconds]);

  const parsedAmount = parseStakeAmount(amount);
  const amountRaw = parsedAmount.ok ? parsedAmount.raw : null;

  const stakeTx = useStakeTransaction({
    config,
    account,
    amountRaw,
    durationSeconds,
    refetchAccount,
  });

  // A known broadcast may still be pending even when receipt polling failed.
  // Keep claim/unstake locked until that hash reaches a terminal receipt state.
  const blocksOtherWriteActions = stakeTx.isBusy || stakeTx.hasPendingHash;

  useEffect(() => {
    onBusyChange?.(blocksOtherWriteActions);
  }, [blocksOtherWriteActions, onBusyChange]);

  // Clear amount only after a confirmed stake — keep success + tx hash visible.
  useEffect(() => {
    if (stakeTx.status === 'success') {
      setAmount('');
    }
  }, [stakeTx.status]);

  const balanceRaw = account ? BigInt(account.balanceRaw) : 0n;
  const balanceFormatted = account
    ? formatUnits(balanceRaw, PRANA_DECIMALS)
    : '—';

  const minStakeRaw = config ? BigInt(config.minStakeRaw) : 0n;
  const minStakeFormatted = config
    ? formatPranaAmount(config.minStakeRaw)
    : '—';

  const selectedDuration = useMemo(
    () => getConfiguredDuration(config?.durations ?? [], durationSeconds),
    [config, durationSeconds],
  );

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
  // Freeze fields once a transaction is broadcast. The CTA remains separately
  // enabled so the user can resume receipt confirmation without changing the
  // amount/duration associated with the pending hash.
  const formFieldsDisabled =
    paused ||
    configLoading ||
    !config ||
    stakeTx.isBusy ||
    stakeTx.hasPendingHash ||
    actionsLocked;

  const canPermitAndStake =
    !formFieldsDisabled &&
    !amountError &&
    parsedAmount.ok &&
    selectedDuration != null &&
    wallet.isConnected;

  // Pending broadcast: allow receipt resume while the form fields stay frozen.
  const canClickCta = stakeTx.hasPendingHash
    ? wallet.isConnected && !stakeTx.isBusy && !actionsLocked
    : canPermitAndStake;

  const ctaPhase = getStakeCtaPhase(
    stakeTx.status,
    stakeTx.hasValidPermit,
    stakeTx.hasPendingHash,
  );
  // After a win, amount is cleared and the button stays on "success" until the
  // user fills the form again — then fall back to the normal idle label.
  const displayPhase =
    ctaPhase === 'success' && canPermitAndStake
      ? 'permit_and_stake'
      : ctaPhase;

  const ctaLabel = (() => {
    switch (displayPhase) {
      case 'signing':
        return copy.signingPermit;
      case 'submitting':
        return copy.stakingSubmitting;
      case 'confirming':
        return copy.stakingConfirming;
      case 'resume_confirming':
        return copy.resumeConfirming;
      case 'success':
        return copy.stakeSuccess;
      case 'continue_stake':
        return copy.continueStake;
      default:
        return copy.permitAndStake;
    }
  })();

  const showCtaSpinner =
    displayPhase === 'signing' ||
    displayPhase === 'submitting' ||
    displayPhase === 'confirming';

  const setMaxAmount = () => {
    if (!account || balanceRaw <= 0n) {
      setAmount('');
      return;
    }
    setAmount(formatUnits(balanceRaw, PRANA_DECIMALS));
  };

  if (configLoading) {
    return (
      <GlassPanel>
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {copy.loadingConfig}
        </div>
      </GlassPanel>
    );
  }

  if (configError || !config) {
    return (
      <GlassPanel>
        <StatusBanner tone="error">{copy.configError}</StatusBanner>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel hoverable>
      <h2 className="flex items-center gap-2 text-lg font-medium tracking-wide text-white">
        <Coins className="h-5 w-5 text-cyan-300" aria-hidden />
        {copy.stakeHeading}
      </h2>

      {paused ? (
        <StatusBanner tone="warning" className="mt-3">
          {copy.pausedBanner}
        </StatusBanner>
      ) : null}

      {!wallet.isPolygon ? (
        <StatusBanner tone="warning" className="mt-3">
          {copy.switchPolygonFirst}
        </StatusBanner>
      ) : null}

      <div className="mt-5 space-y-5">
        {/* Amount input (left) + projected interest (right) on sm+ */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-stretch sm:gap-4">
          <div className="min-w-0">
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
                  <span className="text-white/85">{balanceFormatted}</span>{' '}
                  PRANA
                </span>
                <button
                  type="button"
                  className="rounded-md border border-white/15 px-2 py-0.5 font-semibold text-cyan-300 transition hover:border-cyan-400/40 hover:text-cyan-200 disabled:opacity-40"
                  onClick={setMaxAmount}
                  disabled={
                    formFieldsDisabled || !account || balanceRaw <= 0n
                  }
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
              disabled={formFieldsDisabled}
              placeholder={copy.minStakeHint(minStakeFormatted)}
              onChange={(event) => {
                const value = event.target.value;
                if (isStakeAmountInput(value)) setAmount(value);
              }}
              className="w-full rounded-2xl border border-white/15 bg-transparent px-4 py-3 text-white placeholder:text-white/30 focus:border-[#F5D27A]/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/40 disabled:opacity-50"
            />

            {amountError ? (
              <StatusBanner tone="error" className="mt-2 text-xs">
                {amountError}
              </StatusBanner>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="mb-2 text-sm font-medium text-white/70">
              {copy.projectedInterestLabel}
            </div>
            <div className="flex flex-1 items-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-xl font-semibold text-white">
                ≈ {projectedInterest}{' '}
                <span className="text-sm font-normal text-white/55">PRANA</span>
              </div>
            </div>
          </div>
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
            disabled={formFieldsDisabled}
            labelId="duration-label"
            daysLabel={copy.durationDays}
            aprLabel={copy.aprLabel}
          />
        </div>

        {stakeTx.error ? (
          <StatusBanner tone="error">{stakeTx.error}</StatusBanner>
        ) : null}
        {stakeTx.success ? (
          <StatusBanner tone="success">
            {stakeTx.success}
            {stakeTx.transactionHash ? (
              <>
                {' '}
                <TxLink
                  hash={stakeTx.transactionHash}
                  label={copy.viewOnPolygonscan}
                />
              </>
            ) : null}
          </StatusBanner>
        ) : null}
        {stakeTx.warning ? (
          <StatusBanner tone="warning">{stakeTx.warning}</StatusBanner>
        ) : null}
        {stakeTx.hasPendingHash && stakeTx.transactionHash ? (
          <StatusBanner tone="warning">
            {copy.transactionPending}{' '}
            <TxLink
              hash={stakeTx.transactionHash}
              label={copy.viewOnPolygonscan}
            />
          </StatusBanner>
        ) : null}

        <button
          type="button"
          className="btn-hero btn-gold-border w-full"
          disabled={!canClickCta || actionsLocked}
          onClick={() => void stakeTx.permitAndStake()}
        >
          {showCtaSpinner ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {ctaLabel}
            </span>
          ) : (
            ctaLabel
          )}
        </button>
      </div>
    </GlassPanel>
  );
}
