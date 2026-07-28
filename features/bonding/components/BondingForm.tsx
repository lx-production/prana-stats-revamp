import React, { useEffect, useMemo, useState } from 'react';
import { Coins, Loader2 } from 'lucide-react';
import GlassPanel from '../../../components/ui/GlassPanel.tsx';
import StatusBanner from '../../../components/ui/StatusBanner.tsx';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage.ts';
import { useInjectedWallet } from '../../web3/useInjectedWallet.ts';
import {
  PRANA_DECIMALS,
  WBTC_DECIMALS,
} from '../../../constants/sharedContracts.ts';
import { getBondingCopy } from '../bonding.copy.ts';
import TermSelector from './TermSelector.tsx';
import BondSideTabs from './BondSideTabs.tsx';
import {
  buildBondingQuoteRequest,
  useBondingQuote,
} from '../hooks/useBondingQuote.ts';
import {
  daysFromSeconds,
  formatPranaAmount,
  formatRateBpsPercent,
  formatWbtcAmount,
  getConfiguredTerm,
  getDefaultTermId,
  isBondAmountInput,
  parsePranaAmount,
  parseWbtcAmount,
  rawBalanceToAmountInput,
} from '../bondingMath.ts';

import type {
  BondingAccount,
  BondingConfig,
  BondingQuote,
  BondSide,
  BondTermId,
} from '../bonding.types.ts';

type BuyInputMode = 'exact_wbtc' | 'target_prana';

type BondingFormProps = {
  config: BondingConfig | undefined;
  account: BondingAccount | undefined;
  configLoading: boolean;
  configError: boolean;
  /** Lock form while claim actions run (step 6). */
  actionsLocked?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

/**
 * Buy/Sell bonding form: amount, term, live quote, and CTA fresh-quote review.
 * Wallet approve/create writes land in Bước 5.
 */
export default function BondingForm({
  config,
  account,
  configLoading,
  configError,
  actionsLocked = false,
  onBusyChange,
}: BondingFormProps) {
  const { locale } = useSiteLanguage();
  const copy = getBondingCopy(locale);
  const wallet = useInjectedWallet();

  const [side, setSide] = useState<BondSide>('buy');
  const [buyMode, setBuyMode] = useState<BuyInputMode>('exact_wbtc');
  const [amount, setAmount] = useState('');
  const [termId, setTermId] = useState<BondTermId | null>(null);
  const [reviewedQuote, setReviewedQuote] = useState<BondingQuote | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);

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

  // Input decimals depend on side + buy mode.
  const inputDecimals =
    side === 'sell' || buyMode === 'target_prana'
      ? PRANA_DECIMALS
      : WBTC_DECIMALS;

  const parsedAmount =
    inputDecimals === WBTC_DECIMALS
      ? parseWbtcAmount(amount)
      : parsePranaAmount(amount);
  const amountRaw = parsedAmount.ok ? parsedAmount.raw : null;

  const quoteRequest = useMemo(
    () =>
      buildBondingQuoteRequest({
        side,
        buyMode,
        amountRaw,
        termId,
      }),
    [side, buyMode, amountRaw, termId],
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

  useEffect(() => {
    onBusyChange?.(reviewBusy || quoteState.isLoading);
  }, [onBusyChange, reviewBusy, quoteState.isLoading]);

  // Changing side / buy mode clears amount + reviewed quote; quote hook invalidates too.
  const onSideChange = (next: BondSide) => {
    if (next === side) return;
    setSide(next);
    setAmount('');
    setReviewedQuote(null);
    quoteState.invalidate();
  };

  const onBuyModeChange = (next: BuyInputMode) => {
    if (next === buyMode) return;
    setBuyMode(next);
    setAmount('');
    setReviewedQuote(null);
    quoteState.invalidate();
  };

  const onAmountChange = (value: string) => {
    if (!isBondAmountInput(value, inputDecimals)) return;
    setAmount(value);
    setReviewedQuote(null);
  };

  const onTermChange = (next: BondTermId) => {
    setTermId(next);
    setReviewedQuote(null);
  };

  const wbtcBalanceRaw = account ? BigInt(account.wbtcBalanceRaw) : 0n;
  const pranaBalanceRaw = account ? BigInt(account.pranaBalanceRaw) : 0n;

  // MAX only for exact WBTC Buy and exact PRANA Sell — never target PRANA.
  const showMax =
    side === 'sell' || (side === 'buy' && buyMode === 'exact_wbtc');

  const balanceFormatted = account
    ? buyMode === 'target_prana' && side === 'buy'
      ? formatPranaAmount(pranaBalanceRaw)
      : side === 'sell'
        ? formatPranaAmount(pranaBalanceRaw)
        : formatWbtcAmount(wbtcBalanceRaw)
    : '—';

  const balanceTokenLabel =
    side === 'sell' || buyMode === 'target_prana' ? 'PRANA' : 'WBTC';

  const onMax = () => {
    if (!account || !showMax) return;
    const raw =
      side === 'sell' ? account.pranaBalanceRaw : account.wbtcBalanceRaw;
    const decimals = side === 'sell' ? PRANA_DECIMALS : WBTC_DECIMALS;
    setAmount(rawBalanceToAmountInput(raw, decimals));
    setReviewedQuote(null);
  };

  const selectedTerm = getConfiguredTerm(terms, termId);

  const paused =
    side === 'buy'
      ? Boolean(config?.paused.buyV2)
      : Boolean(config?.paused.sellV2);

  const minBuyRaw = config ? BigInt(config.minBuyPranaRaw) : 0n;
  const minSellRaw = config ? BigInt(config.minSellPranaRaw) : 0n;

  const amountError = useMemo(() => {
    if (!amount) return null;
    if (parsedAmount.ok === false) {
      return copy.amountReasons[parsedAmount.reason];
    }
    // Target PRANA buy: compare against min buy PRANA.
    if (side === 'buy' && buyMode === 'target_prana' && config) {
      if (parsedAmount.raw < minBuyRaw) {
        return copy.minBuyHint(formatPranaAmount(config.minBuyPranaRaw));
      }
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
    if (side === 'buy' && buyMode === 'exact_wbtc' && account) {
      if (parsedAmount.raw > wbtcBalanceRaw) {
        return copy.exceedsBalance;
      }
    }
    return null;
  }, [
    amount,
    parsedAmount,
    side,
    buyMode,
    config,
    minBuyRaw,
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
    reviewBusy ||
    actionsLocked;

  const amountLabel =
    side === 'sell' || buyMode === 'target_prana'
      ? copy.amountLabelPrana
      : copy.amountLabelWbtc;

  const displayQuote = reviewedQuote ?? quoteState.quote;

  const onReviewCta = async () => {
    if (!wallet.isConnected || !wallet.isPolygon) return;
    setReviewBusy(true);
    try {
      // Always fresh-quote on CTA — even if the live quote looks current.
      const fresh = await quoteState.freshQuote();
      if (!fresh) {
        setReviewedQuote(null);
        return;
      }
      setReviewedQuote(fresh);
    } finally {
      setReviewBusy(false);
    }
  };

  const canReview =
    !formFieldsDisabled &&
    !amountError &&
    parsedAmount.ok &&
    selectedTerm != null &&
    wallet.isConnected &&
    wallet.isPolygon &&
    !quoteState.isLoading;

  return (
    <GlassPanel hoverable>
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-[#F5D27A]" aria-hidden />
          <h2 className="text-lg font-medium tracking-wide">
            {side === 'buy' ? copy.buyTab : copy.sellTab}
          </h2>
        </div>

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

        <div className="space-y-2">
          <p id="bond-side-label" className="text-sm text-white/55">
            {copy.buyTab} / {copy.sellTab}
          </p>
          <BondSideTabs
            side={side}
            onSelect={onSideChange}
            disabled={formFieldsDisabled}
            buyLabel={copy.buyTab}
            sellLabel={copy.sellTab}
            labelId="bond-side-label"
          />
        </div>

        {side === 'buy' ? (
          <div
            role="radiogroup"
            aria-label={copy.buyExactWbtcMode}
            className="grid grid-cols-2 gap-2"
          >
            {(
              [
                ['exact_wbtc', copy.buyExactWbtcMode],
                ['target_prana', copy.buyTargetPranaMode],
              ] as const
            ).map(([mode, label]) => {
              const selected = buyMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={formFieldsDisabled}
                  onClick={() => onBuyModeChange(mode)}
                  className={`
                    rounded-xl border px-3 py-2 text-xs font-semibold transition-all
                    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5D27A]
                    disabled:cursor-not-allowed disabled:opacity-50
                    ${
                      selected
                        ? 'border-[#F5D27A]/45 bg-[#F5D27A]/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/70 hover:border-white/25'
                    }
                  `}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <label htmlFor="bond-amount" className="text-white/55">
              {amountLabel}
            </label>
            <span className="text-white/45">
              {copy.balanceLabel}: {balanceFormatted} {balanceTokenLabel}
            </span>
          </div>
          <div className="flex gap-2">
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
            {showMax ? (
              <button
                type="button"
                disabled={formFieldsDisabled || !account}
                onClick={onMax}
                className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold text-[#F5D27A] transition hover:border-[#F5D27A]/35 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copy.maxButton}
              </button>
            ) : null}
          </div>
          {amountError ? (
            <StatusBanner tone="error">{amountError}</StatusBanner>
          ) : null}
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

        <QuotePanel
          copy={copy}
          side={side}
          buyMode={buyMode}
          quote={displayQuote}
          isLoading={quoteState.isLoading || reviewBusy}
          error={quoteState.error}
          isStale={quoteState.isStale && reviewedQuote == null}
          hasAmount={Boolean(amount) && parsedAmount.ok}
        />

        <button
          type="button"
          disabled={!canReview}
          onClick={() => void onReviewCta()}
          className="btn-hero btn-gold-border inline-flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {reviewBusy || quoteState.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {reviewBusy ? copy.refreshingQuote : copy.reviewQuote}
        </button>

        {reviewedQuote && reviewedQuote.issues.length === 0 ? (
          <StatusBanner tone="success">{copy.quoteReady}</StatusBanner>
        ) : null}
      </div>
    </GlassPanel>
  );
}

type QuotePanelProps = {
  copy: ReturnType<typeof getBondingCopy>;
  side: BondSide;
  buyMode: BuyInputMode;
  quote: BondingQuote | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  hasAmount: boolean;
};

function QuotePanel({
  copy,
  side,
  buyMode,
  quote,
  isLoading,
  error,
  isStale,
  hasAmount,
}: QuotePanelProps) {
  if (isLoading) {
    return <StatusBanner tone="neutral">{copy.quoteLoading}</StatusBanner>;
  }
  if (error) {
    return <StatusBanner tone="error">{copy.quoteError}</StatusBanner>;
  }
  if (!hasAmount) {
    return <StatusBanner tone="neutral">{copy.quoteEmpty}</StatusBanner>;
  }
  if (!quote) {
    return <StatusBanner tone="neutral">{copy.quoteEmpty}</StatusBanner>;
  }

  const primaryLabel =
    side === 'sell'
      ? copy.expectedWbtc
      : buyMode === 'exact_wbtc'
        ? copy.expectedPrana
        : copy.requiredWbtc;

  const primaryValue =
    side === 'sell' || buyMode === 'target_prana'
      ? `${formatWbtcAmount(quote.wbtcAmountRaw)} WBTC`
      : `${formatPranaAmount(quote.pranaAmountRaw)} PRANA`;

  const secondaryValue =
    side === 'sell' || buyMode === 'target_prana'
      ? `${formatPranaAmount(quote.pranaAmountRaw)} PRANA`
      : `${formatWbtcAmount(quote.wbtcAmountRaw)} WBTC`;

  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      {isStale ? (
        <StatusBanner tone="warning">{copy.quoteStale}</StatusBanner>
      ) : null}
      {side === 'buy' && buyMode === 'target_prana' ? (
        <StatusBanner tone="warning">
          {copy.targetPranaNoMaxInWarning}
        </StatusBanner>
      ) : null}
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-white/55">{primaryLabel}</span>
        <span className="font-medium text-white">{primaryValue}</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-white/45">
        <span>
          {buyMode === 'target_prana' && side === 'buy'
            ? copy.expectedPrana
            : side === 'sell'
              ? copy.amountLabelPrana
              : copy.amountLabelWbtc}
        </span>
        <span>{secondaryValue}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45">
        <span>
          {copy.rateLabel}: {formatRateBpsPercent(quote.rateBpsRaw)}
        </span>
        <span>{copy.durationLabel(daysFromSeconds(quote.durationSeconds))}</span>
        <span>
          {quote.reserveSource === 'market'
            ? copy.reserveSourceMarket
            : copy.reserveSourceImpacted}
        </span>
      </div>
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
