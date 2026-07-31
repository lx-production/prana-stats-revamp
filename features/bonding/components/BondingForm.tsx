import BondSideTabs from './BondSideTabs.tsx';
import TermSelector from './TermSelector.tsx';
import TxLink from '../../../components/ui/TxLink.tsx';
import React, { useEffect, useMemo, useState } from 'react';
import GlassPanel from '../../../components/ui/GlassPanel.tsx';
import CreateBondReviewDialog from './CreateBondReviewDialog.tsx';
import StatusBanner from '../../../components/ui/StatusBanner.tsx';

import { Loader2 } from 'lucide-react';
import { getBondingCopy } from '../bonding.copy.ts';
import { getBondCtaPhase } from '../utils/bondCtaPhase.ts';
import { useBondTransaction } from '../hooks/useBondTransaction.ts';
import { useInjectedWallet } from '../../web3/useInjectedWallet.ts';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage.ts';
import { PRANA_DECIMALS, WBTC_DECIMALS } from '../../../constants/sharedContracts.ts';
import { buildBondingQuoteRequest, useBondingQuote } from '../hooks/useBondingQuote.ts';
import { formatPranaAmount, formatWbtcAmount, getConfiguredTerm, getDefaultTermId, isBondAmountInput, parsePranaAmount, parseWbtcAmount, rawBalanceToAmountInput } from '../utils/bondingMath.ts';

import type { BondingAccount, BondingConfig, BondingQuote, BondSide, BondTermId } from '../bonding.types.ts';

type BondingFormProps = {
  config: BondingConfig | undefined;
  account: BondingAccount | undefined;
  configLoading: boolean;
  configError: boolean;
  /** Lock form while claim actions run (step 6). */
  actionsLocked?: boolean;
  onBusyChange?: (busy: boolean) => void;
  refetchAccount: () => Promise<unknown>;
  refetchConfig: () => Promise<unknown>;
};

/**
 * Buy/Sell bonding form: amount, term, live quote, and Approve → Review → Create.
 * Buy always takes exact WBTC; Sell always takes exact PRANA.
 */
export default function BondingForm({
  config,
  account,
  configLoading,
  configError,
  actionsLocked = false,
  onBusyChange,
  refetchAccount,
  refetchConfig,
}: BondingFormProps) {
  const { locale } = useSiteLanguage();
  const copy = getBondingCopy(locale);
  const wallet = useInjectedWallet();

  const [side, setSide] = useState<BondSide>('buy');
  const [amount, setAmount] = useState('');
  const [termId, setTermId] = useState<BondTermId | null>(null);

  const terms = side === 'buy' ? (config?.buyTerms ?? []) : (config?.sellTerms ?? []);

  // Default to 30 days when present. If refreshed config removes the selected
  // term, move to a valid option instead of submitting a vanished termId.
  useEffect(() => {
    if (!config) return;
    const nextTerms = side === 'buy' ? config.buyTerms : config.sellTerms;
    const configured = getConfiguredTerm(nextTerms, termId);
    if (configured) return;
    setTermId(getDefaultTermId(nextTerms));
  }, [config, side, termId]);

  const inputDecimals = side === 'sell' ? PRANA_DECIMALS : WBTC_DECIMALS;

  const parsedAmount =
    inputDecimals === WBTC_DECIMALS
      ? parseWbtcAmount(amount)
      : parsePranaAmount(amount);
  const amountRaw = parsedAmount.ok ? parsedAmount.raw : null;

  const quoteRequest = useMemo(
    () =>
      buildBondingQuoteRequest({
        side,
        amountRaw,
        termId,
      }),
    [side, amountRaw, termId],
  );

  const quoteEnabled =
    Boolean(config) &&
    !configLoading &&
    !configError &&
    quoteRequest != null &&
    parsedAmount.ok;

  const quoteState = useBondingQuote({
    enabled: quoteEnabled,
    request: quoteRequest,
  });

  const bondTx = useBondTransaction({
    config,
    account,
    side,
    amountRaw,
    termId,
    quote: quoteState.quote,
    freshQuote: quoteState.freshQuote,
    refetchAccount,
    refetchConfig,
  });

  useEffect(() => {
    onBusyChange?.(
      bondTx.isBusy || quoteState.isLoading || bondTx.status === 'reviewing',
    );
  }, [
    onBusyChange,
    bondTx.isBusy,
    bondTx.status,
    quoteState.isLoading,
  ]);

  // Clear amount only after a confirmed create — keep success + tx hash visible.
  useEffect(() => {
    if (bondTx.status === 'success') {
      setAmount('');
      quoteState.invalidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- success edge only
  }, [bondTx.status]);

  // Changing side clears amount; quote hook invalidates too.
  const onSideChange = (next: BondSide) => {
    if (next === side) return;
    setSide(next);
    setAmount('');
    quoteState.invalidate();
    bondTx.clearMessages();
  };

  const onAmountChange = (value: string) => {
    if (!isBondAmountInput(value, inputDecimals)) return;
    setAmount(value);
    bondTx.clearMessages();
  };

  const onTermChange = (next: BondTermId) => {
    setTermId(next);
    bondTx.clearMessages();
  };

  const wbtcBalanceRaw = account ? BigInt(account.wbtcBalanceRaw) : 0n;
  const pranaBalanceRaw = account ? BigInt(account.pranaBalanceRaw) : 0n;

  const balanceFormatted = account
    ? side === 'sell'
      ? formatPranaAmount(pranaBalanceRaw)
      : formatWbtcAmount(wbtcBalanceRaw)
    : '—';

  const balanceTokenLabel = side === 'sell' ? 'PRANA' : 'WBTC';

  const onMax = () => {
    if (!account) return;
    const raw =
      side === 'sell' ? account.pranaBalanceRaw : account.wbtcBalanceRaw;
    const decimals = side === 'sell' ? PRANA_DECIMALS : WBTC_DECIMALS;
    setAmount(rawBalanceToAmountInput(raw, decimals));
    bondTx.clearMessages();
  };

  const selectedTerm = getConfiguredTerm(terms, termId);

  const paused =
    side === 'buy'
      ? Boolean(config?.paused.buyV2)
      : Boolean(config?.paused.sellV2);

  const minSellRaw = config ? BigInt(config.minSellPranaRaw) : 0n;

  const amountError = useMemo(() => {
    if (!amount) return null;
    if (parsedAmount.ok === false) {
      return copy.amountReasons[parsedAmount.reason];
    }
    // Exact PRANA sell: compare against min sell PRANA.
    if (side === 'sell' && config) {
      if (parsedAmount.raw < minSellRaw) {
        return copy.minSellHint(formatPranaAmount(config.minSellPranaRaw));
      }
      if (account && parsedAmount.raw > pranaBalanceRaw) {
        return copy.exceedsBalance;
      }
    }
    // Exact WBTC buy: balance check only (min is on PRANA output, shown via quote issues).
    if (side === 'buy' && account) {
      if (parsedAmount.raw > wbtcBalanceRaw) {
        return copy.exceedsBalance;
      }
    }
    return null;
  }, [
    amount,
    parsedAmount,
    side,
    config,
    minSellRaw,
    account,
    pranaBalanceRaw,
    wbtcBalanceRaw,
    copy,
  ]);

  const formFieldsDisabled =
    paused ||
    configLoading ||
    !config ||
    bondTx.isBusy ||
    bondTx.reviewOpen ||
    actionsLocked;

  const amountLabel =
    side === 'sell' ? copy.amountLabelPrana : copy.amountLabelWbtc;

  const displayQuote = bondTx.reviewQuote ?? quoteState.quote;

  const canSubmit =
    !formFieldsDisabled &&
    !amountError &&
    parsedAmount.ok &&
    selectedTerm != null &&
    wallet.isConnected &&
    wallet.isPolygon &&
    !quoteState.isLoading &&
    quoteState.quote != null &&
    quoteState.quote.issues.length === 0;

  // Pending broadcast: allow confirmation resume while fields stay frozen.
  const canClickCta = bondTx.hasPendingHash
    ? wallet.isConnected && !bondTx.isBusy && !actionsLocked
    : canSubmit;

  const ctaPhase = getBondCtaPhase(
    bondTx.status,
    bondTx.needsApproval,
    bondTx.hasPendingHash,
  );

  const displayPhase =
    ctaPhase === 'success' && canSubmit ? 'review' : ctaPhase;

  const ctaLabel = (() => {
    switch (displayPhase) {
      case 'approve':
        return bondTx.status === 'approving'
          ? copy.approvingCta
          : copy.approveCta;
      case 'create':
        return bondTx.status === 'submitting'
          ? copy.creatingBondCta
          : copy.createBondCta;
      case 'confirming':
        return copy.confirmingCta;
      case 'confirmation_unavailable':
        return copy.resumeConfirmingCta;
      case 'success':
        return copy.bondSuccessCta;
      case 'error':
        return bondTx.needsApproval ? copy.approveCta : copy.reviewQuote;
      default:
        return quoteState.isLoading || bondTx.status === 'reviewing'
          ? copy.refreshingQuote
          : copy.reviewQuote;
    }
  })();

  const showCtaSpinner =
    bondTx.isBusy ||
    bondTx.status === 'reviewing' ||
    (quoteState.isLoading && displayPhase === 'review');

  return (
    <GlassPanel hoverable>
      <div className="space-y-5">
        {/* Buy / Sell as underline tabs — replaces the old dual-button switcher. */}
        <BondSideTabs
          side={side}
          onSelect={onSideChange}
          disabled={formFieldsDisabled}
          buyLabel={copy.buyTab}
          sellLabel={copy.sellTab}
          ariaLabel={`${copy.buyTab} / ${copy.sellTab}`}
        />

        {configLoading ? (
          <StatusBanner tone="neutral">{copy.loadingConfig}</StatusBanner>
        ) : null}
        {configError ? (
          <StatusBanner tone="error">{copy.configError}</StatusBanner>
        ) : null}
        {paused ? (
          <StatusBanner tone="warning">
            {side === 'buy' ? copy.pausedBuyBanner : copy.pausedSellBanner}
          </StatusBanner>
        ) : null}
        {wallet.isConnected && !wallet.isPolygon ? (
          <StatusBanner tone="warning">{copy.switchPolygonFirst}</StatusBanner>
        ) : null}

        {/* Amount (left) + live quote (right) — mirror Staking amount/interest row. */}
        <div className="!mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-stretch sm:gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <label htmlFor="bond-amount" className="text-white/55">
                {amountLabel}
              </label>
              <div className="flex items-center gap-2 text-xs text-white/45">
                <span>
                  {copy.balanceLabel}: {balanceFormatted} {balanceTokenLabel}
                </span>
                <button
                  type="button"
                  disabled={formFieldsDisabled || !account}
                  onClick={onMax}
                  className="rounded-md border border-white/15 px-2 py-0.5 font-semibold text-[#F5D27A] transition hover:border-[#F5D27A]/35 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {copy.maxButton}
                </button>
              </div>
            </div>
            <input
              id="bond-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              disabled={formFieldsDisabled}
              onChange={(event) => onAmountChange(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#F5D27A]/45 disabled:opacity-50"
              placeholder="0.0"
            />
            {amountError ? (
              <StatusBanner tone="error">{amountError}</StatusBanner>
            ) : null}
          </div>

          <QuotePanel
            copy={copy}
            side={side}
            quote={displayQuote}
            isLoading={quoteState.isLoading && !bondTx.reviewOpen}
            error={quoteState.error}
            isStale={quoteState.isStale && bondTx.reviewQuote == null}
            hasAmount={Boolean(amount) && parsedAmount.ok}
          />
        </div>

        <div className="space-y-2">
          <p id="bond-term-label" className="text-sm text-white/55">
            {copy.termLabel}
          </p>
          <TermSelector
            options={terms}
            selectedTermId={termId}
            onSelect={onTermChange}
            disabled={formFieldsDisabled || terms.length === 0}
            labelId="bond-term-label"
            daysLabel={copy.durationLabel}
            rateLabel={copy.ratePercent}
          />
        </div>

        {bondTx.error ? (
          <StatusBanner
            tone={
              bondTx.status === 'confirmation_unavailable'
                ? 'warning'
                : 'error'
            }
          >
            {bondTx.error}
          </StatusBanner>
        ) : null}
        {bondTx.warning ? (
          <StatusBanner tone="warning">{bondTx.warning}</StatusBanner>
        ) : null}
        {bondTx.success ? (
          <StatusBanner tone="success">{bondTx.success}</StatusBanner>
        ) : null}
        {bondTx.transactionHash ? (
          <div className="text-sm">
            <TxLink hash={bondTx.transactionHash} label="Polygonscan" />
          </div>
        ) : null}

        <button
          type="button"
          disabled={!canClickCta}
          onClick={() => void bondTx.onPrimaryCta()}
          className="!mt-8 btn-hero btn-gold-border inline-flex w-full items-center justify-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {showCtaSpinner ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {ctaLabel}
        </button>
      </div>

      {bondTx.reviewOpen && bondTx.reviewQuote ? (
        <CreateBondReviewDialog
          quote={bondTx.reviewQuote}
          copy={copy}
          busy={bondTx.status === 'submitting' || bondTx.status === 'confirming'}
          error={
            bondTx.reviewOpen && bondTx.status !== 'confirmation_unavailable'
              ? bondTx.error
              : null
          }
          onConfirm={() => void bondTx.onConfirmCreate()}
          onCancel={bondTx.closeReview}
        />
      ) : null}
    </GlassPanel>
  );
}

type QuotePanelProps = {
  copy: ReturnType<typeof getBondingCopy>;
  side: BondSide;
  quote: BondingQuote | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  hasAmount: boolean;
};

function QuotePanel({
  copy,
  side,
  quote,
  isLoading,
  error,
  isStale,
  hasAmount,
}: QuotePanelProps) {
  const primaryLabel = side === 'sell' ? copy.expectedWbtc : copy.expectedPrana;

  // Empty / loading / error states still fill the right column so the row stays aligned.
  if (isLoading) {
    return (
      <div className="flex min-w-0 flex-col">
        <div className="mb-2 text-sm text-white/55">{primaryLabel}</div>
        <div className="flex flex-1 items-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/55">
          {copy.quoteLoading}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-w-0 flex-col">
        <div className="mb-2 text-sm text-white/55">{primaryLabel}</div>
        <StatusBanner tone="error" className="flex-1">
          {copy.quoteError}
        </StatusBanner>
      </div>
    );
  }
  if (!hasAmount || !quote) {
    return (
      <div className="flex min-w-0 flex-col">
        <div className="mb-2 text-sm text-white/55">{primaryLabel}</div>
        <div className="flex flex-1 items-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/40">
          {copy.quoteEmpty}
        </div>
      </div>
    );
  }

  const primaryValue =
    side === 'sell'
      ? formatWbtcAmount(quote.wbtcAmountRaw)
      : formatPranaAmount(quote.pranaAmountRaw);
  const primaryToken = side === 'sell' ? 'WBTC' : 'PRANA';

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="text-sm text-white/55">{primaryLabel}</div>
      <div className="flex flex-1 flex-col justify-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
        <div className="text-xl font-semibold text-white">
          {primaryValue}{' '}
          <span className="text-sm font-normal text-white/55">
            {primaryToken}
          </span>
        </div>
      </div>
      {isStale ? (
        <StatusBanner tone="warning">{copy.quoteStale}</StatusBanner>
      ) : null}
      {quote.issues.length > 0 ? (
        <div className="space-y-1">
          {quote.issues.map((issue) => (
            <StatusBanner key={issue} tone="warning">
              {copy.quoteIssues[issue]}
            </StatusBanner>
          ))}
        </div>
      ) : null}
    </div>
  );
}
